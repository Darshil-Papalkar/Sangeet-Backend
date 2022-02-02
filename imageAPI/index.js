const { client } = require('../DBConnect/index');
const { downloadFile } = require('../awsS3Client');

const getMimeType = (key) => {
    const type = key.split('.');
    const mimetype = type[type.length-1];

    return mimetype;
};

const getImageKey = async (req, res) => {
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
};

const getArtistImageKey = async (req, res) => {
    try{
        const key = req.params.id;
        const data = await client.query(`SELECT "artistImgKey" FROM "musicPlayer-schema"."artists" WHERE "id" = $1`, [key]);
        if(data.rowCount > 0){
            res.send({code: 200, message: data.rows[0]});
        }
        else{
            res.send({code: 404, message: "Couldn't find the artistImg for particular ID"});
        }
    }
    catch(err){
        console.log("Error Occured while getting Image Key", err);
        res.send({code: 500, message: "Can't Fetch Image Key"});
    }
};

const getImage = async (req, res) => {
    try{
        const key = req.params.key;
        if(key === `undefined`) {
            return ;
        }
    
        const mimetype = getMimeType(key);
    
        const readStream = await downloadFile(key);    
        const readStreamBody = readStream.Body;
    
        res.writeHead(200, {'Content-Type': `image/${mimetype}`});
        res.write(readStreamBody, 'base64');
        res.end(null, 'base64');
    }
    catch(err){
        console.log("Error Occurred while downloading image File", err.message);
        res.send({code: 404, message: err.message});
    }
};

const getArtistImageByName = async (req, res) => {
    try{
        const artistName = req.params.artistName;
        const dbResponse = await client.query(`SELECT "artistImgKey" FROM "musicPlayer-schema"."artists" WHERE "name" = $1`, [artistName]);
        // console.log(dbResponse.rows[0]);
        if(dbResponse.rowCount > 0){
            const key = dbResponse.rows[0].artistImgKey;
            const mimetype = getMimeType(key);
            const readStream = await downloadFile(key);
            const readStreamBody = readStream.Body;

            res.writeHead(200, {'Content-Type': `image/${mimetype}`});
            res.write(readStreamBody, 'base64');
            res.end(null, 'base64');
            // res.send({code: 200, message: dbResponse.rows[0].artistImgKey});
        }
        else{
            res.send(null);
        }
    }
    catch(err){
        console.log("Error Occurred while downloading artist image File", err);
        res.send({code: 404, message: err.message});
    }
};

exports.getImage = getImage;
exports.getImageKey = getImageKey;
exports.getArtistImageKey = getArtistImageKey;
exports.getArtistImageByName = getArtistImageByName;
