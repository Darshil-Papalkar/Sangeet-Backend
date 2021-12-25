const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const util = require('util');
const path = require('path');
const { Client } = require('pg');

const { uploadFile, downloadFile, getBuckets, deleteFile } = require('./awsS3Client');

const app = express();
app.use(cors());
app.use(express.json());

const unlinkFile = util.promisify(fs.unlink);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if(file.mimetype === 'audio/mp3' ||
            file.mimetype === 'audio/mpeg3' || 
            file.mimetype === 'audio/x-mpeg-3' ||
            file.mimetype === 'audio/mpeg'){
            cb(null, 'uploadSongs/');
        }
        else if(file.mimetype === 'image/jpg' || 
                file.mimetype === 'image/jpeg' || 
                file.mimetype === 'image/png'){
            cb(null, 'uploadSongImages/');
        }
        else{
            console.log("File Type - ", file.mimetype);
            cb({
                error: "Mime type not supported"
            })
        }
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// DB connection verification

const credentials = {
    user: process.env.AWS_POSTGRES_USERNAME ,
    host: process.env.AWS_POSTGRES_ENDPOINT ,
    database: process.env.AWS_POSTGRES_DB_NAME ,
    password: process.env.AWS_POSTGRES_PASSWORD ,
    port: process.env.AWS_POSTGRES_PORT 
};

const client = new Client(credentials);
client.connect(err => {
    if(err){
        console.log("Couldn't connect to DB", err);
    }
    else{
        console.log("Successfully connected to DB");
    }
})

app.get("/", (req, res) => {
    res.send("Hello From Server");
});

app.get("/status", (req, res) => {
    res.sendStatus(200);
});

// get music List

app.get("/getAllMusic", async(req, res) => {
    try{
        const data = await client.query(`SELECT "id", "musicTitle", "albumTitle", "artists", "genre", "category" FROM
                                        "musicPlayer-schema"."musicData"`);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows});
        }
        else{
            res.send({code: 404, message: "No Data Found"});
        }
    }
    catch(err){
        console.log("Error while getting music all files", err);
        res.send({code: 500, message: "Something went wrong while fetching music Info."});
    }
});

app.get("/imageKey/:id", async (req, res) => {
    try{
        const key = req.params.id;
        const data = await client.query(`SELECT "musicImageKey" FROM "musicPlayer-schema"."musicData" WHERE "id" = $1`, [key]);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows[0]});
        }
        else{
            res.send({code: 404, message: "Couldn't find the musicImage for particular ID"});
        }
    }
    catch(err){
        console.log("Error Occured while getting Image Key", err);
        res.send({code: 500, message: "Can't Fetch Image Key"});
    }
});

app.get("/audioKey/:id", async (req, res) => {
    try{
        const key = req.params.id;
        const data = await client.query(`SELECT "musicKey" FROM "musicPlayer-schema"."musicData" WHERE "id" = $1`, [key]);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows[0]});
        }
        else{
            res.send({code: 404, message: "Couldn't find the audio for particular ID"});
        }
    }
    catch(err){
        console.log("Error Occured while getting audio key", err);
        res.send({code: 500, message:"Can't Fetch Audio key"});
    }
});

// get media files

const getMimeType = (key) => {
    const type = key.split('.');
    const mimetype = type[type.length-1];

    return mimetype;
};

app.get("/image/:key", async (req, res) => {
    try{
        const key = req.params.key;
        const mimetype = getMimeType(key);
    
        const readStream = await downloadFile(key);    
        const readStreamBody = readStream.Body;
    
        res.writeHead(200, {'Content-Type': `image/${mimetype}`});
        res.write(readStreamBody, 'base64');
        res.end(null, 'base64');
    }
    catch(err){
        console.log("Error Occurred while downloading image File", err);
        res.send({code: 404, message: err.message});
    }
});

app.get("/audio/:key", async (req, res) => {
    try{
        const key = req.params.key;
        const mimetype = getMimeType(key);
    
        const readStream = await downloadFile(key);
    
        const readStreamBody = readStream.Body;
    
        res.writeHead(200, {'Content-Type': `audio/${mimetype}`});
        res.write(readStreamBody, 'binary');
        res.end(null, 'binary');
    }
    catch(err){
        console.log("Error Occurred while downloading audio File", err);
        res.send({code: 404, message: err.message});
    }
});


////// Admin  //////

// Bucket Connection Verification

getBuckets();

// adding new files

const uploadFiles = async (files) => {
    let objFile = {};

    try{
        await Promise.all(files.map(async (obj) => {
            let result = await uploadFile(obj);
            if(obj.mimetype.split('/')[0] === "image")
                objFile['imageFile'] = result.Key;
            else
                objFile['audioFile'] = result.Key;
            await unlinkFile(obj.path);
        }));
        return objFile;
    }
    catch(err){
        console.log("Error occured while file uploading", err);
        return {};
    }
};

app.post('/addNewSong', upload.any(), async (req, res) => {
    const files = req.files;
    const body = req.body;

    try{
        if(files){
            const data = await uploadFiles(files);
            if(Object.keys(data).length > 0){
                const {audioFile, imageFile} = data;
                const genre = body.genre.split(',');
                const artists = body.artist.split(',');
                const category = body.category.split(',');
    
                const result = await client.query(`INSERT INTO "musicPlayer-schema"."musicData" ("musicTitle", "albumTitle", 
                    "genre", "category", "artists", "musicKey", "musicImageKey", "timeStamp") VALUES 
                    ($1, $2, $3, $4, $5, $6, $7, $8) returning *`, 
                    [body.musicTitle, body.albumTitle, genre, category, artists,
                    audioFile, imageFile, body.date]);

                delete result.rows[0].musicKey;
                delete result.rows[0].musicImageKey;
                delete result.rows[0].timeStamp;

                if(result.rowCount === 1){
                    console.log("Files Uploaded Successfully");
                    res.send({code: 200, message: "Done Successfully", rowData: result.rows[0]});
                }
                else{
                    console.log("Failed to add data to DB");
                    res.send({code: 500, message: "Failed to add data to DB"});
                }
            }
            else{
                console.log("Uploading files failed!");
                res.send({code: 500, message: "Uploading files failed!"});
            }
        }
        else{
            console.log("Missing Media Files, please upload both Audio File and Image File");
            res.send({code: 404, message: "Missing Media Files, please upload both Audio File and Image File"});
        }
    }
    catch(err){
        files.map(async (obj) => await unlinkFile(obj.path));
        console.log("File Upload Error Occured - ", err.message || err);
        res.send({code: 500, message: "Something Went Wrong, please try again!"});
    }

});

// adding new artists

app.post('/postNewArtists', upload.any(), async (req, res) => {
    const file = req.files;
    const names = req.body.names;
    try{
        if(file.length > 0){
            const awsResponse = await uploadFiles(file);
            if(Object.keys(awsResponse).length > 0){
                const {imageFile} = awsResponse;
    
                const queryResponse = await client.query(`INSERT INTO "musicPlayer-schema"."artists" 
                    ("name", "artistImgKey") VALUES ($1, $2)`, [names, imageFile]);
                if(queryResponse.rowCount > 0){
                    console.log("Artist Added Successfully");
                    res.send({code: 200, message: "Artist Added Successfully"});
                }
                else{
                    console.log("Couldn't add artist to DB");
                    res.send({code: 500, message: "Couldn't add artist to DB"});
                }
            }
            else{
                console.log("Error while uploading file");
                res.send({code: 500, message: "Error while uploading file"});
            }
        }
        else{
            const error = new Error();
            error.code = 404;
            error.message = "Missing Media File";
            console.log("Missing Media File");
            res.send(error);
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
});

// adding new genre

app.post('/postNewGenre', async (req, res) => {
    const types = req.body.types;
    try{
        if(types.length > 0){
            await Promise.all(types.map(async (type) => {
                await client.query(`INSERT INTO "musicPlayer-schema"."genre"
                ("type") VALUES ($1)`, [type]);
            }));
            console.log("Added New Genre Successfully");
            res.send({code: 200, message: "Added New Genre Successfully"});
        }
        else{
            res.send({code: 404, message: "Enter Atleast One Genre Type"});
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
});

// adding new category

app.post('/postNewCategory', async (req, res) => {    
    const types = req.body.types;
    try{
        if(types.length > 0){
            await Promise.all(types.map(async (type) => {
                await client.query(`INSERT INTO "musicPlayer-schema"."category"
                ("type") VALUES ($1)`, [type])
            }));
            console.log("Added New Category Successfully");
            res.send({code: 200, message: "Added New Category Successfully"});
        }
        else{
            res.send({code: 404, message: "Enter Atleast One Category Type"});
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
    
});

// deleting files

const deleteFiles = async (files) => {

    const awsResponse = {
        Errors: [],
    };

    try{
        await Promise.all(files.map(async (obj) => {
            const result = await deleteFile(obj);
        }));
    }
    catch(err){
        console.log(err);
        awsResponse.Errors.push(err);
    }
    finally{
        return awsResponse;
    }
};

app.delete('/admin/musicDelete/:id', async (req, res) => {
    const id = req.params.id;

    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."musicData" WHERE "id" = $1 
                                    RETURNING "musicKey", "musicImageKey"`, [id]);
                                    
        if(dbData.rowCount > 0) {
            const files = [];
            files.push(dbData.rows[0].musicKey);
            files.push(dbData.rows[0].musicImageKey);
            const response = await deleteFiles(files);

            if(response.Errors.length > 0){
                console.log(response.Errors);
                res.send({code: 400, message: "File Deletion Error from AWS"});
            }
            else{
                console.log("Data Deleted Successfully for Id", id);
                res.send({code: 200, message: "Data Deleted Successfully"});
            }
        }
        else{
            console.log("No Data Found for respective Id", id);
            res.send({code: 404, message: "No Data Found"});
        }        
    }
    catch(err){
        console.log("An Error Occurred while deleting files", err);
        return err;
    }
});

app.delete('/admin/artistDelete/:id', async (req, res) => {
    const id = req.params.id;

    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."artists" WHERE "id" = $1
                                        RETURNING "artistImgKey"`, [id]);
        if(dbData.rowCount > 0){
            const files = [];
            files.push(dbData.rows[0].artistImgKey);
            const response = await deleteFiles(files);

            if(response.Errors.length > 0){
                console.log(response.Errors);
                res.send({code: 400, message: "File Deletion Error from AWS"});
            }
            else{
                console.log("Data Deleted Successfully for Id", id);
                res.send({code: 200, message: "Data Deleted Successfully"});
            }
        }
        else{
            console.log("No Data Found for respective Id", id);
            res.send({code: 404, message: "No Data Found"});
        } 
    }
    catch(err){
        console.log("An Error Occurred while deleting files", err);
        return err;
    }
});

// express port connection

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Listening on port - ${port}`);
});