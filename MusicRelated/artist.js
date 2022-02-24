const fs = require('fs');
const util = require('util');

const { client } = require("../DBConnect/index");
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

const getAllArtist = async (req, res) => {
    try{
        const data = await client.query(`SELECT "id", "name", "show" FROM
        "musicPlayer-schema"."artists" ORDER BY "id"`);
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

const addArtist = async (req, res) => {
    const file = req.files;
    const names = req.body.names;
    const show = req.body.show;
    try{
        if(file.length > 0){
            const awsResponse = await uploadFiles(file);
            if(Object.keys(awsResponse).length > 0){
                const {imageFile} = awsResponse;
    
                const queryResponse = await client.query(`INSERT INTO "musicPlayer-schema"."artists" 
                ("name", "artistImgKey", "show") VALUES ($1, $2, $3) returning *`, [names.trim(), imageFile, show]);

                delete queryResponse?.rows[0]?.artistImgKey;
                
                if(queryResponse.rowCount > 0){
                    console.log("Artist Added Successfully");
                    res.send({code: 200, message: "Artist Added Successfully", rowData: queryResponse.rows});
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
};

const updateArtistFav = async (req, res) => {
    const id = req.params.id;
    const show = req.body.state;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."artists" SET "show"=$1 WHERE "id" = $2`, [ show, id ]);
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

const updateArtist = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    const file = req.files;
    try{
        let imageFile = '';
        if(file.length > 0){
            const awsResponse = await uploadFiles(file);
            if(Object.keys(awsResponse).length > 0){
                imageFile = awsResponse.imageFile;
            }
            
            const files = [];
            files.push(body.musicImgKey);
            const response = await deleteFiles(files);
            
            if(response.Errors.length > 0){
                console.log(response.Errors);
                return res.send({code: 400, message: "File Deletion Error from AWS"});
            }
            else{
                console.log("Data Deleted Successfully for artist Id", id);
            }
        }
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."artists" SET "name"=$1, "show"=$2, 
                                        "artistImgKey" = $3 WHERE "id" = $4`, 
                                        [body.name, body.show, body.artistImg ? body.musicImgKey : imageFile, id]);
        if(dbRes.rowCount > 0){
            const oldData = await client.query(`SELECT "id", "artists" FROM "musicPlayer-schema"."musicData" 
                                                WHERE $1=ANY("artists")`, [body.old]);
    
            const data = oldData.rows;

            const promises = data.map(async (rowData) => {
                const index = rowData.artists.indexOf(body.old);
                rowData.artists.splice(index, 1, body.name);
                await client.query(`UPDATE "musicPlayer-schema"."musicData" SET "artists" = $1 WHERE "id" = $2`,
                                    [ rowData.artists, rowData.id ]);
            });
    
            await Promise.all(promises);
            
            res.send({code: 200, message: "Artist Updated Successfully"});
        }
        else{
            res.send({code: 404, message: "No Artist found for requested Id"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating artist", err);
        res.send({code: 500, message: err.message});
    }
};

const deleteArtist = async (req, res) => {
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
                console.log("Data Deleted Successfully for artist Id", id);
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

exports.addArtist = addArtist
exports.updateArtist = updateArtist;
exports.deleteArtist = deleteArtist;
exports.getAllArtist = getAllArtist;
exports.updateArtistFav = updateArtistFav;
