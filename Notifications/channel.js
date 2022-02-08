const fs = require('fs');
const util = require('util');
const webpush = require('web-push');

const { client } = require('../DBConnect/index');
const { uploadFile, deleteFile } = require('../awsS3Client');

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

const Broadcast = async (req, res) => {
    const file = req.files;
    const body = req.body;    
    try{
        const awsResponse = await uploadFiles(file);
        if(Object.keys(awsResponse).length > 0){
            const { imageFile } = awsResponse;

            const queryResponse = await client.query(`INSERT INTO "musicPlayer-schema"."broadcast" 
                ("title", "body", "image", "timestamp", "url") VALUES ($1, $2, $3, $4, $5) returning *`, 
                [body.title, body.body, imageFile, body.today, body.url]);

            if(queryResponse.rowCount > 0){
                const notification = {
                    title: body.title,
                    body: JSON.stringify({
                        body: body.body,
                        url : body.url,
                    }),
                    icon: `http://localhost:5000/image/${imageFile}`,
                };
    
                const subscriptions = await client.query('SELECT * FROM "musicPlayer-schema"."subscription"');
        
                const notifications = [];
        
                subscriptions.rows.forEach(subscription => {
                    notifications.push(
                        webpush.sendNotification(subscription, JSON.stringify(notification))
                    );
                });
        
                await Promise.all(notifications);
                delete queryResponse.rows[0].image;
                res.send({ code: 200, rowData: queryResponse.rows, message: "Successfully Broadcasted" });
            }
            else{
                res.send({ code: 500, message: "Couldn't Add Broadcast to DB"});
            }
        }
        else{
            res.send({ code: 404, message: "Missing media File" });
        }
    }
    catch(err){
        console.log("An Error occured while broadcasting\n", err);
        res.sendStatus(err.statusCode);
    }
};

const Subscription = async (req, res) => {
    const today = req.body.today;
    const endpoint = req.body.endpoint;
    const subscription = req.body.subscription;
    try{
        if(endpoint){
            const notificationExists = await client.query(`SELECT "id" FROM "musicPlayer-schema"."subscription" WHERE "endpoint" = $1`,[endpoint]);
            if(notificationExists.rowCount > 0){
                return res.sendStatus(200);
            }
        }

        const response = await client.query(`SELECT * FROM "musicPlayer-schema"."subscription" WHERE "endpoint" = $1`, [subscription.endpoint]);
        // console.log(response.rowCount);
        if(response.rowCount === 0){
            const dbRes = await client.query(`INSERT INTO "musicPlayer-schema"."subscription" ("endpoint", "expirationTime", 
                                                    "keys", "timeStamp") VALUES ($1, $2, $3, $4)`, 
                                [subscription.endpoint, subscription.expirationTime, subscription.keys, today]);
            if(dbRes.rowCount > 0){
                res.send({code: 200, message: ""});
            }
            else{
                res.send({code: 404, message: ""});
            }
        }
        else{
            res.send({code: 400, message: ""});
        }
    }
    catch(err){
        console.log(err);
        res.sendStatus(500);
    }
};

const Unsubscription = async (req, res) => {
    const endpoint = req.body.endpoint;
    
    try{
        const response = await client.query(`DELETE FROM "musicPlayer-schema"."subscription" WHERE "endpoint" = $1`, 
                        [endpoint]);
        if(response.rowCount > 0){
            res.send({ code: 200, message: "Unsubscribed" });
        }
        else{
            res.send({ code: 404 });
        }
    }
    catch(err){
        res.send({ code: 500 });
    }
};

const getBroadCast = async (req, res) => {
    try{
        const data = await client.query(`SELECT * FROM "musicPlayer-schema"."broadcast" ORDER BY "id"`);
        if(data.rowCount > 0){
            for(let i=0; i < data.rowCount; i++){
                delete data.rows[i].image;
            }
            res.send({ code: 200, message: data.rows });
        }
        else{
            res.send({ code: 404, message: "No Data Found" });
        }
    }
    catch(err){
        console.log("Error while fetching broadcast data", err);
        res.send({ code: 500, message: "Something went wrong" });
    }
};

const getBroadCastNotifications = async (req, res) => {
    try{
        const resData = await client.query(`SELECT "timeStamp" FROM "musicPlayer-schema"."subscription" 
                                            WHERE "endpoint" = $1`, [req.query.endpoint]);
                                            
        const subscriptionTimestamp = new Date(resData.rows[0].timeStamp).toISOString();

        const queryData = await client.query(`SELECT * FROM "musicPlayer-schema"."broadcast" WHERE 
                                            "timestamp" >= $1 ORDER BY "id" DESC`, [subscriptionTimestamp]);

        if(queryData.rowCount > 0){
            res.send({ code: 200, message: queryData.rows });
        }
        else{
            res.send({ code: 404, message: [] });
        }
    }
    catch(err){
        console.log("Error while fetching broadcast notification data", err);
        res.send({ code: 500, message: "Something went wrong" });
    }
};

const DeleteBroadCast = async (req, res) => {
    const id = req.params.id;

    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."broadcast" WHERE "id" = $1
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

exports.Broadcast = Broadcast;
exports.getBroadCast = getBroadCast;
exports.Subscription = Subscription;
exports.Unsubscription = Unsubscription;
exports.DeleteBroadCast = DeleteBroadCast;
exports.getBroadCastNotifications = getBroadCastNotifications;