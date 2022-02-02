const { client } = require("../DBConnect/index");

const getAllCategory = async (req, res) => {
    try{
        const data = await client.query(`SELECT "id", "type", "show" FROM
        "musicPlayer-schema"."category" ORDER BY "id"`);
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

const addCategory = async (req, res) => {    
    const types = req.body.types;
    const show = req.body.show;
    try{
        if(types.length > 0){
            const result = [];
            await Promise.all(types.map(async (type) => {
                const pro = await client.query(`INSERT INTO "musicPlayer-schema"."category"
                ("type", "show") VALUES ($1, $2) returning *`, [type, show]);
                result.push(pro.rows[0]);
            }));
            
            console.log("Added New Category Successfully");
            res.send({code: 200, message: "Added New Category Successfully", rowData: result});
        }
        else{
            res.send({code: 404, message: "Enter Atleast One Category Type"});
        }
    }
    catch(err){
        console.log(err);
        res.send({code: 500, message: err.message});
    }
};

const updateCategoryFav = async (req, res) => {
    const id = req.params.id;
    const show = req.body.state;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."category" SET "show"=$1 WHERE "id" = $2`, [ show, id ]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: show ? "Added Favourite" : "Removed Favourite"});
        }
        else{
            res.send({code: 404, message: "Entry not found"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating category", err);
        res.send({code: 500, message: err.message});
    }
};

const updateCategory = async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try{
        const dbRes = await client.query(`UPDATE "musicPlayer-schema"."category" SET "type" = $1, "show" = $2 WHERE "id" = $3`, 
                                        [body.type, body.show, id]);
        if(dbRes.rowCount > 0){
            res.send({code: 200, message: "Category Updated Successfully"});
        }
        else{
            res.send({code: 404, message: "No Category found for requested Id"});
        }
    }
    catch(err){
        console.log("An Error Occurred while updating category", err);
        res.send({code: 500, message: err.message});
    }
};

const deleteCategory = async (req, res) => {
    const id = req.params.id;
    try{
        const dbData = await client.query(`DELETE FROM "musicPlayer-schema"."category" WHERE "id" = $1`, [id]);

        if(dbData.rowCount > 0){
            console.log("Data Deleted Successfully for category Id", id);
            res.send({code: 200, message: "Category deleted successfully"});
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

exports.addCategory = addCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.getAllCategory = getAllCategory;
exports.updateCategoryFav = updateCategoryFav;
