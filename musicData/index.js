const fs = require('fs');
const util = require('util');

const { client } = require('../DBConnect/index');
const { deleteFile, uploadFile } = require('../awsS3Client');

const unlinkFile = util.promisify(fs.unlink);

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

const musicData = async(req, res) => {
    try{
        const data = await client.query(`SELECT "id", "musicTitle", "albumTitle", "artists", "genre", "category", "musicImageKey",
                                         "musicKey", "timeStamp", "show", "duration" FROM "musicPlayer-schema"."musicData"`);
        const artistData = await client.query(`SELECT "id", "name", "show" FROM
                                            "musicPlayer-schema"."artists"`);
        const genreData = await client.query(`SELECT "id", "type", "show" FROM
                                            "musicPlayer-schema"."genre"`);
        const categoryData = await client.query(`SELECT "id", "type", "show" FROM
                                            "musicPlayer-schema"."category"`);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows.sort(() => Math.random() - 0.5), 
                    artistData: artistData.rows, genreData: genreData.rows, categoryData: categoryData.rows});
        }
        else{
            res.send({code: 404, message: "No Data Found"});
        }
    }
    catch(err){
        console.log("Error while getting music all files", err);
        res.send({code: 500, message: "Something went wrong while fetching music Info."});
    }
};

const getMusic = async(req, res) => {
    try{
        const data = await client.query(`SELECT "id", "musicTitle", "albumTitle", "artists", "genre", "category", "show", "duration" FROM
                                        "musicPlayer-schema"."musicData" ORDER BY "id"`);
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
};

const getMusicIdNameAlbum = async (req, res) => {
    try{
        const data = await client.query(`SELECT "id", "musicTitle", "albumTitle", "musicImageKey" FROM
                                        "musicPlayer-schema"."musicData" ORDER BY "id"`);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows});
        }
        else{
            res.send({code: 404, message: "No Data Found"});
        }
    }
    catch(err){
        console.log("Error while getting music selected files", err);
        res.send({code: 500, message: "Something went wrong while fetching music Info."});
    }
};

const addMusic = async (req, res) => {
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
                    "genre", "category", "artists", "musicKey", "musicImageKey", "timeStamp", "show", "duration") VALUES 
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`, 
                    [body.musicTitle, body.albumTitle, genre, category, artists,
                    audioFile, imageFile, body.date, body.show, body.duration]);

                delete result.rows[0].musicKey;
                delete result.rows[0].musicImageKey;
                delete result.rows[0].timeStamp;

                if(result.rowCount === 1){
                    console.log("Files Uploaded Successfully");
                    res.send({code: 200, message: "Done Successfully", rowData: result.rows});
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

};

const toggleMusicFav = async (req, res) => {
    const id = req.params.id;
    const show = req.body.state;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."musicData" SET "show"=$1 WHERE "id" = $2`, [ show, id ]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: show ? "Added Favourite" : "Removed Favourite"});
        }
        else{
            res.send({code: 404, message: "Entry not found"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating artist", err);
        res.send({code: 500, message: err.message});
    }
};

const updateMusicData = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try{
        const dbResponse = await client.query(`UPDATE "musicPlayer-schema"."musicData" SET 
                            "musicTitle"=$1, "albumTitle"=$2, "artists"=$3, "genre"=$4, "category"=$5, "timeStamp"=$6, "show"=$7
                            WHERE "id" = $8 returning "musicTitle", "albumTitle", "artists", "genre", "category", "id", "show"`, 
                            [body.musicTitle, body.albumTitle, JSON.parse(body.artist), JSON.parse(body.genre), 
                            JSON.parse(body.category), body.date, body.show, id]);
        if(dbResponse.rowCount > 0){
            res.send({code: 200, message: "Updated data successfully", data: dbResponse.rows[0]});
        }
        else{
            res.send({code: 404, message: "Not able to save data for provided id"});
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
};

const deleteMusic = async (req, res) => {
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
                res.send({code: 400, message: "File Deletion Failed from AWS"});
            }
            else{
                console.log("Data Deleted Successfully for music Id", id);
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
        res.send({code: 500, message: err.message});
    }
};

exports.addMusic = addMusic;
exports.getMusic = getMusic;
exports.musicData = musicData;
exports.deleteMusic = deleteMusic;
exports.toggleMusicFav = toggleMusicFav;
exports.updateMusicData = updateMusicData;
exports.getMusicIdNameAlbum = getMusicIdNameAlbum;
