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

const createPlaylist = async (req, res) => {
    const file = req.files;
    const name = req.body.name;
    const show = req.body.show;
    try{
        if(file.length > 0){
            
            const awsResponse = await uploadFiles(file);
            if(Object.keys(awsResponse).length > 0){
                const {imageFile} = awsResponse;

                const dbRes = await client.query(`INSERT INTO "musicPlayer-schema"."playlist" ("playlist_name", "song_id", 
                                                    "show", "image") VALUES ($1, $2, $3, $4) returning *`, 
                                                    [name, [], show, imageFile]);
                
                if(dbRes.rowCount > 0){
                    delete dbRes.rows[0].image;
                    console.log("Playlist Added Successfully");
                    res.send({ code: 200, message: "Successfully Added Playlist", rowData: dbRes.rows });
                } 
                else{
                    console.log("Couldn't add playlist to DB");
                    res.send({ code: 400, message: "Cannot Create Playlist" });
                }
            }
            else{
                console.log("Error while uploading file");
                res.send({code: 500, message: "Error while uploading file"});
            }
        }
        else{
            res.send({ code: 404, message: "Missing Media File" });
        }
    }
    catch(err){
        console.log("Something went wrong while creating playlist", err);
        res.send({ code: 500, message: err.message });
    }
};

const getAllPlaylist = async (req, res) => {
    try{
        const dbRes = await client.query(`SELECT * FROM "musicPlayer-schema"."playlist"`);
        if(dbRes.rowCount > 0){
            res.send({ code: 200, message: dbRes.rows });
        }
        else{
            res.send({ code: 404, message: "No Data Found" });
        }
    }
    catch(err){
        console.log("Error while fetching playlist data", err);
        res.send({ code: 500, message: err.message });
    }
};

const getAllFavPlaylist = async (req, res) => {
    try{
        const dbRes = await client.query(`SELECT * FROM "musicPlayer-schema"."playlist" WHERE "show" = true`);
        if(dbRes.rowCount > 0){
            res.send({ code: 200, message: dbRes.rows });
        }
        else{
            res.send({ code: 404, message: "No Data Found" });
        }
    }
    catch(err){
        console.log("Error while fetching playlist data", err);
        res.send({ code: 500, message: err.message });
    }
};

const getPlaylistById = async (req, res) => {
    const id = req.params.id;
    try{
        const dbRes = await client.query(`SELECT "id", "musicTitle", "albumTitle", "musicImageKey" FROM 
                                            "musicPlayer-schema"."musicData" WHERE "id" = ANY ((
                                                SELECT "song_id" FROM "musicPlayer-schema"."playlist" WHERE "id" = $1
                                        )::int[])`, [id]);
        if(dbRes.rowCount > 0){
            res.send({ code: 200, message: dbRes.rows });
        }
        else{
            res.send({ code: 404, message: "No Data Found" });
        }
    }
    catch(err){
        console.log("An Error Occured while fetching playlist", err);
        res.send({ code: 500, message: err.message });
    }
};

const updatePlaylist = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."playlist" SET "playlist_name" = $1, "show" = $2 WHERE "id" = $3`, 
                                        [body.name, body.show, id]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: "Playlist Updated Successfully"});
        }
        else{
            res.send({code: 404, message: "No Playlist found for requested Id"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating playlist", err);
        res.send({code: 500, message: err.message});
    }
};

const updatePlaylistFav = async (req, res) => {
    const id = req.params.id;
    const show = req.body.state;

    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."playlist" SET "show"=$1 WHERE "id" = $2`, [ show, id ]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: show ? "Added Favourite" : "Removed Favourite"});
        }
        else{
            res.send({code: 404, message: "Entry not found"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating playlist", err);
        res.send({code: 500, message: err.message});
    }
};

const updatePlaylistSongs = async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."playlist" SET "song_id" = $1 WHERE "id" = $2`, 
                                        [data.data, id]);
        if(dbRes.rowCount > 0){
            res.send({ code: 200, message: "Playlist updated Successfully" });
        }
        else{
            res.send({ code: 404, message: "No Such Row Found for provided id" });
        }
    }
    catch(err){
        console.log("An Error occurred while updating playlist", err);
        res.send({ code: 500, message: "Entry not found" });
    }
};

const deletePlaylist =  async (req, res) => {
    const id = req.params.id;

    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."playlist" WHERE "id" = $1
                                        RETURNING "image"`, [id]);
        if(dbData.rowCount > 0){
            const files = [];
            files.push(dbData.rows[0].image);
            const response = await deleteFiles(files);

            if(response.Errors.length > 0){
                console.log(response.Errors);
                res.send({code: 400, message: "File Deletion Error from AWS"});
            }
            else{
                console.log("Data Deleted Successfully for playlist Id", id);
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

exports.createPlaylist = createPlaylist;
exports.deletePlaylist = deletePlaylist;
exports.getAllPlaylist = getAllPlaylist;
exports.updatePlaylist = updatePlaylist;
exports.getPlaylistById = getPlaylistById;
exports.getAllFavPlaylist = getAllFavPlaylist;
exports.updatePlaylistFav = updatePlaylistFav;
exports.updatePlaylistSongs = updatePlaylistSongs;
