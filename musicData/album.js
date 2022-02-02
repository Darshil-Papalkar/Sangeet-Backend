const { client } = require("../DBConnect/index");

const getAlbumByName = async (req, res) => {
    const albumName = req.params.albumName;
    try{
        const dbRes = await client.query(`SELECT * FROM "musicPlayer-schema"."musicData" WHERE "albumTitle" = $1 and "show" = true`, 
                                    [albumName]);
        if(dbRes.rowCount > 0){
            dbRes.rows.forEach(entry => {
                delete entry.timeStamp;
            });
            res.send({code: 200, message: dbRes.rows});
        }
        else{
            res.send({code: 404, message: "No Data found for requested album"});
        }
    }
    catch(err){
        console.log(`An error occured while fetching ${albumName} album details -`, err);
        res.send({code: 500, message: err.message});
    }
};

exports.getAlbumByName = getAlbumByName;