const webpush = require('web-push');

const { client } = require('../DBConnect/index');

const Broadcast = async (req, res) => {
    try{
        const notification = {
            title: 'Hey, this is a push notification!',
            body: "How are you",
            action: "www.google.com/",
            icon: "https://i.ibb.co/swhgyPb/favicon.png",
        };
        const subscriptions = await client.query('SELECT * FROM "musicPlayer-schema"."subscription"');

        const notifications = [];

        subscriptions.rows.forEach(subscription => {
            notifications.push(
                webpush.sendNotification(subscription, JSON.stringify(notification))
            );
        });

        await Promise.all(notifications);
        res.sendStatus(200);
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
            await client.query(`DELETE FROM "musicPlayer-schema"."subscription" WHERE "endpoint" = $1`,[endpoint]);
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

exports.Broadcast = Broadcast;
exports.Subscription = Subscription;
exports.Unsubscription = Unsubscription;