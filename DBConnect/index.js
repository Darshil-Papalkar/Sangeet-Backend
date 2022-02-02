const { Client } = require('pg');


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
});

exports.client = client;