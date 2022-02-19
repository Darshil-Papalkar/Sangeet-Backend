const { client } = require("../DBConnect/index");

const getAllGenre = async (req, res) => {
    try{
        const data = await client.query(`SELECT "id", "type", "show" FROM
        "musicPlayer-schema"."genre" ORDER BY "id"`);
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

const addGenre = async (req, res) => {
    const types = req.body.types;
    const show = req.body.show;
    try{
        if(types.length > 0){
            const result = [];
            await Promise.all(types.map(async (type) => {
                const pro = await client.query(`INSERT INTO "musicPlayer-schema"."genre"
                ("type", "show") VALUES ($1, $2) returning *`, [type, show]);
                result.push(pro.rows[0]);
            }));
            
            console.log("Added New Genre Successfully");
            res.send({code: 200, message: "Added New Genre Successfully", rowData: result});
        }
        else{
            res.send({code: 404, message: "Enter Atleast One Genre Type"});
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
};

const updateGenreFav = async (req, res) => {
    const id = req.params.id;
    const show = req.body.state;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."genre" SET "show"=$1 WHERE "id" = $2`, [ show, id ]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: show ? "Added Favourite" : "Removed Favourite"});
        }
        else{
            res.send({code: 404, message: "Entry not found"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating genre", err);
        res.send({code: 500, message: err.message});
    }
};

const updateGenre = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."genre" SET "type"=$1, "show"=$2 WHERE "id" = $3`, 
                                        [body.type, body.show, id]);
        if(dbRes.rowCount > 0){
            const oldData = await client.query(`SELECT "id", "genre" FROM "musicPlayer-schema"."musicData" 
                                                WHERE $1=ANY("genre")`, [body.old]);
    
            const data = oldData.rows;

            const promises = data.map(async (rowData) => {
                const index = rowData.genre.indexOf(body.old);
                rowData.genre.splice(index, 1, body.type);
                await client.query(`UPDATE "musicPlayer-schema"."musicData" SET "genre" = $1 WHERE "id" = $2`,
                                    [ rowData.genre, rowData.id ]);
            });
    
            await Promise.all(promises);

            res.send({code: 200, message: "Genre Updated Successfully"});
        }
        else{
            res.send({code: 404, message: "No Genre found for requested Id"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating genre", err);
        res.send({code: 500, message: err.message});
    }
};

const deleteGenre = async (req, res) => {
    const id = req.params.id;
    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."genre" WHERE "id" = $1`, [id]);

        if(dbData.rowCount > 0){
            console.log("Data Deleted Successfully for genre Id", id);
            res.send({code: 200, message: "Genre deleted successfully"});
        }
        else{
            console.log("No Data Found for respective id", id);
            res.send({code: 404, message: "No Data Found"});
        }
    }
    catch(err){
        console.log("An Error Occurred", err);
        res.send({code: 500, message: err.message}); 
    }
};

exports.addGenre = addGenre;
exports.updateGenre = updateGenre;
exports.deleteGenre = deleteGenre;
exports.getAllGenre = getAllGenre;
exports.updateGenreFav = updateGenreFav;
