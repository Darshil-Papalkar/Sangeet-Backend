const cors = require('cors');
const path = require('path');
const multer = require('multer');
const express = require('express');

const { webPush } = require('./webpush');
const { getAudioKey, getAudio } = require('./audioAPI');
const { getAlbumByName } = require('./musicData/album');
const { getArtistByName } = require('./musicData/artist');
const { getBuckets } = require('./awsS3Client');
const { Subscription, Broadcast, Unsubscription } = require('./Notifications/channel');
const { getImageKey, getArtistImageKey, getImage, getArtistImageByName } = require('./imageAPI');

const { musicData, getMusic, addMusic, 
        toggleMusicFav, updateMusicData, deleteMusic } = require('./musicData/index');

const { getAllGenre, addGenre, updateGenre, 
        updateGenreFav, deleteGenre } = require('./MusicRelated/genre');

const { getAllArtist, addArtist, updateArtist, 
        updateArtistFav, deleteArtist } = require('./MusicRelated/artist');

const { getAllCategory, addCategory, updateCategory, 
        updateCategoryFav, deleteCategory } = require('./MusicRelated/category');


const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if(file.mimetype === 'audio/mp3' ||
            file.mimetype === 'audio/mpeg3' || 
            file.mimetype === 'audio/x-mpeg-3' ||
            file.mimetype === 'audio/mpeg'){
            cb(null, 'uploadSongs/');
        }
        else if(file.mimetype === 'image/jpg' || 
                file.mimetype === 'image/jpeg' || 
                file.mimetype === 'image/png'){
            cb(null, 'uploadSongImages/');
        }
        else{
            console.log("File Type - ", file.mimetype);
            cb({
                error: "Mime type not supported"
            })
        }
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    res.send("Hello From Server");
});

app.get("/status", (req, res) => {
    res.sendStatus(200);
});

// Notifications -- webpush

app.get('/broadcast', Broadcast);
app.post('/subscription', Subscription);
app.delete('/unsubcription', Unsubscription);
// Getting data

app.get("/getAllMusic", getMusic);
app.get("/getAllGenre", getAllGenre);
app.get("/getAllArtists", getAllArtist);
app.get("/getAllMusicDetails", musicData);
app.get("/getAllCategory", getAllCategory);

// Getting Custom Data

app.get("/album/:albumName", getAlbumByName);
app.get("/artist/:artistName", getArtistByName);

// Getting Media Keys

app.get("/imageKey/:id", getImageKey);
app.get("/audioKey/:id", getAudioKey);
app.get("/artistImageKey/:id", getArtistImageKey);

// Getting Media Files

app.get("/image/:key", getImage);
app.get("/audio/:key", getAudio);
app.get("/getImageByArtistName/:artistName", getArtistImageByName);


////// Admin  //////

// adding new files

app.post('/addNewSong', upload.any(), addMusic);

// adding new metadata

app.post('/postNewGenre', addGenre);
app.post('/postNewCategory', addCategory);
app.post('/postNewArtists', upload.any(), addArtist);

// updating existing data

app.put('/admin/updateData/:id', updateMusicData);
app.put('/admin/updateMusicFav/:id', toggleMusicFav);

// updating existing metadata

app.put('/admin/updateArtist/:id', updateArtist);
app.put('/admin/updateArtistFav/:id', updateArtistFav);

app.put('/admin/updateGenre/:id', updateGenre);
app.put('/admin/updateGenreFav/:id', updateGenreFav);

app.put('/admin/updateCategory/:id', updateCategory);
app.put('/admin/updateCategoryFav/:id', updateCategoryFav);


// deleting data and metadata

app.delete('/admin/musicDelete/:id', deleteMusic);
app.delete('/admin/artistDelete/:id', deleteArtist);
app.delete("/admin/genreDelete/:id", deleteGenre);
app.delete("/admin/categoryDelete/:id", deleteCategory);

// express port connection

const port = process.env.PORT || 5000;
app.listen(port, () => {

    webPush();
    getBuckets();
    console.log(`Listening on port - ${port}`);
});