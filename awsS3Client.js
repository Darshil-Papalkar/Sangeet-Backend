require('dotenv').config();
const fs = require('fs');
const S3 = require('aws-sdk/clients/s3');


const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_BUCKET_ACCESS_KEY;
const secretAccessKey = process.env.AWS_BUCKET_SECRET_KEY;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

// getting bucket details

const getBuckets = async () => {
    s3.listBuckets(function(err, data) {
        if(err){
            console.log("Bucket Listing Error", err);
        }
        else{
            console.log("Connected to S3 Bucket Successfully");
        }
    })
};

// uploads a file to S3

const uploadFile = async (file) => {
    const fileStream = fs.createReadStream(file.path);
    
    const uploadParams = {
        Bucket: bucketName,
        Body: fileStream,
        Key: file.filename
    };
    
    return s3.upload(uploadParams).promise();
};


// download a file from S3

const downloadFile = async (keyId) => {
    const downloadParams = {
        Key: keyId,
        Bucket: bucketName
    };
    
    const awsFile = await s3.getObject(downloadParams).promise();
    return awsFile;
};

// delete file from S3

const deleteFile = async (key) => {
    const deleteParams = {
        Bucket: bucketName,
        Key: key,
    };

    const awsResponse = await s3.deleteObject(deleteParams).promise();
    return awsResponse;
};

exports.getBuckets = getBuckets;
exports.uploadFile = uploadFile;
exports.downloadFile = downloadFile;
exports.deleteFile = deleteFile;