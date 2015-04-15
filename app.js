//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy; //ADDED
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var graph = require('fbgraph');
var mongoose = require('mongoose');
var app = express();


//local dependencies
var models = require('./models');


//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
var INSTAGRAM_ACCESS_TOKEN = "";
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

var FACEBOOK_APP_ID = "1037035612991295";
var FACEBOOK_APP_SECRET = "a7f5db616a09e29c1433eb0877e1c216";
var conf = {
    client_id:      '1037035612991295'
  , client_secret:  'a7f5db616a09e29c1433eb0877e1c216'
  , scope:          'public_profile, user_friends, email'
  , redirect_uri:   'http://localhost:3000/auth/facebook/callback'
};


//connect to database
mongoose.connect('mongodb://localhost/tmp/data');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    models.User.findOrCreate({
      "name": profile.username,
      "id": profile.id,
      "access_token": accessToken 
    }, function(err, user, created) {
      
      // created will be true here
      models.User.findOrCreate({}, function(err, user, created) {
        // created will be false here 
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      })
    });
  }
)); 

passport.use(new FacebookStrategy({
    clientID: "1037035612991295",
    clientSecret: "a7f5db616a09e29c1433eb0877e1c216",
    callbackURL: "http://localhost:3000/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
        // created will be false here 
        process.nextTick(function () {

         graph.setAccessToken(accessToken);
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      }

)); 

//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
    return next(); 
  }
  res.redirect('/login');
}


//routes

app.get('/login', function(req, res){
   
  res.render('login', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
          
    var query  = models.User.where({ name: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);

    if (user) {
      // doc may be null if no document matched
             console.log("test");
      Instagram.users.info({
        user_id: user.id,
        access_token: user.access_token,
       // user_id:req.user.id,
        complete: function(data) {
         var user_profilePicture = data.profile_picture;
          var firstName = data.full_name.substr(0, data.full_name.indexOf(' '));
          console.log("full name is  "+firstName);
          res.render('account', {user: req.user, user_profilePicture: user_profilePicture, firstName:firstName});
        }
      }); 
    }
  });
});

app.get('/facebook',ensureAuthenticated, function(req, res){
  console.log("first req.user is "+req.user.csv);
  var query  = models.User.where({ name: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      console.log("the token is "+user.access_token);

 graph.get('/me', function(err,res1) {
    //res.send(res2); // sends text response to browser
   console.log(res1);

    //console.log(res2.data[0].story);
    res.render('facebook',{res1:res1/*, first_name:res1.first_name*/});
  })

 }

});

});


app.get('/photos', ensureAuthenticated, function(req, res){
  var query  = models.User.where({ name: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched
      Instagram.media.popular({
        access_token: user.access_token,

        complete: function(data) {
          //Map will iterate through the returned data obj
          var imageArr = data.map(function(item) {
            //create temporary json object
              tempJSON = {};
              tempJSON.caption2 = item.tags;
              console.log(tempJSON.caption2); 
              tempJSON.url = item.images.low_resolution.url; 
            //tempJSON.caption2 = item.caption.text;
             

            //insert json object into image array
            return tempJSON;
          });

          res.render('photos', {photos: imageArr});
        }
      }); 
    }
  });
});


app.get('/photos2', ensureAuthenticated, function(req, res){
  var query  = models.User.where({ name: req.user.username });
   
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched
      var user_profilePicture="";
      Instagram.users.self({
        access_token: user.access_token,

       // user_id:req.user.id,
        complete: function(data) {
          //Map will iterate through the returned data obj
          var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = {};
            tempJSON.url2 = item.images.low_resolution.url;
            tempJSON.pp = item.caption.text;//BY ME
            tempJSON.totallikes = item.likes.data.username;
          
             tempJSON.the_profilePicture = item.user.profile_picture;
             tempJSON.mediaID = item.id;

            return tempJSON;
          });

            var mediaLike = data.map(function(item){
              console.log("Enter mediaLike, before returning");
              console.log(item.id);  

            return Instagram.media.likes({media_id:item.id, access_token:user.access_token});
                
              }); 
               console.log("after liking media");

         Instagram.users.info({
        user_id: user.id,
        access_token: user.access_token,
       // user_id:req.user.id,

        complete: function(data) {
         user_profilePicture = data.profile_picture;    
          res.render('photos2', {photos: imageArr,user: req.user, user_profilePicture: user_profilePicture, mediaLike:mediaLike});
        }
      }); 

        }
      }); //instagram.users.self

     
      
    }//user if ends
  });
});


// GET /auth/instagram
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Instagram authentication will involve
//   redirecting the user to instagram.com.  After authorization, Instagram
//   will redirect the user back to this application at /auth/instagram/callback
app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });
app.get('/auth/facebook',
  function(req, res){
// we don't have a code yet
  // so we'll redirect to the oauth dialog
  if (!req.query.code) {
    var authUrl = graph.getOauthUrl({
        "client_id":     conf.client_id
      , "redirect_uri":  conf.redirect_uri
      , "scope":         conf.scope
    });

    if (!req.query.error) { //checks whether a user denied the app facebook login/permissions
      res.redirect(authUrl);
    } else {  //req.query.error == 'access_denied'
      res.send('access denied');
    }
    return;
  }

  // code is set
  // we'll send that and get the access token
  graph.authorize({
      "client_id":      conf.client_id
    , "redirect_uri":   conf.redirect_uri
    , "client_secret":  conf.client_secret
    , "code":           req.query.code
  }, function (err, facebookRes) {
    res.redirect('/facebook');
  });

    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });
app.get('/auth/facebook', passport.authenticate('facebook', { scope : ['email', 'user_likes'] }));
// GET /auth/instagram/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/photos2');
  });


app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/facebook');
  });



app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login');
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
