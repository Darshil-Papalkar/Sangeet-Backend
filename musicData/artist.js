const { client } = require('../DBConnect/index');

const getArtistByName = async (req, res) => {
    const artistName = req.params.artistName;
    try{
        const dbRes = await client.query(`SELECT * FROM "musicPlayer-schema"."musicData" WHERE $1=ANY("artists") AND "show"=true`, [artistName]);
        if(dbRes.rowCount > 0){
            dbRes.rows.forEach(entry => {
                delete entry.timeStamp;
            });
            res.send({code: 200, message: dbRes.rows});
        }
        else{
            res.send({code: 404, message: "No Data found for requested artist"});
        }
    }
    catch(err){
        console.log(`An error occured while fetching ${artistName} artist details -`, err);
        res.send({code: 500, message: err.message});
    }
};

exports.getArtistByName = getArtistByName;
