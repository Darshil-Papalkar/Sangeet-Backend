const { client } = require('../DBConnect/index');
const { downloadFile }  = require('../awsS3Client');


const getMimeType = (key) => {
    const type = key.split('.');
    const mimetype = type[type.length-1];

    return mimetype;
};

const getAudioKey = async (req, res) => {
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
};

const getAudio = async (req, res) => {
    try{
        const key = req.params.key;
        if(key === `undefined`) {
            return res.sendStatus(400);
        }
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
};

exports.getAudio = getAudio;
exports.getAudioKey = getAudioKey;
