var Bourne, Engine, _, app, async, e, express, games, port;
var http = require('http');

var parseString = require('xml2js').parseString;
var AWS = require('aws-sdk');
AWS.config.apiVersions = {
  sqs: '2012-11-05',
};
AWS.config.update({accessKeyId: '', secretAccessKey: ''});
var ObjectId = require('mongodb').ObjectID;
var cookieSession = require('cookie-session');
var sns = new AWS.SNS({region:'us-east-1'});
_ = require('underscore');
var MongoClient = require('mongodb').MongoClient;
var Reloader = require('reload-json'),
reload = new Reloader();
var fs = require('fs');
//var url = "mongodb://localhost:27017/test2";
var url = "";
games = require('./data/games.json');
var bodyParser = require('body-parser');
async = require('async');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var FACEBOOK_APP_ID = '';
var FACEBOOK_APP_SECRET = '';
Bourne = require('bourne');
express = require('express');
var host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
var port = process.env.PORT || 8080;
var cors_proxy = require('cors-anywhere');
//cors_proxy.createServer({
//    originWhitelist: [], // Allow all origins
//    requireHeader: ['origin', 'x-requested-with'],
//    removeHeaders: ['cookie', 'cookie2']
//}).listen(port, host, function() {
//    console.log('Running CORS Anywhere on ' + host + ':' + port);
//});
Engine = require('./lib/engine');
e = new Engine;
app = express();
app.set('views', __dirname + "/views");
app.use(express.static(__dirname + '/views'));
app.set('view engine', 'jade');
app.use(cookieSession({name : 'session', keys : ['key1', 'key2']}));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


passport.use(new FacebookStrategy({
  clientID: '',
  clientSecret: '',
  callbackURL: 'http://gamereco-env.elasticbeanstalk.com/auth/facebook/callback',
  profileFields: ['id', 'name', 'displayName' , 'emails'],
  auth_type: "reauthenticate"

}, function(accessToken, refreshToken, profile, done) {
  process.nextTick(function() {
    //Assuming user exists
    done(null, profile);
  });
}));

passport.serializeUser(function(user, done) {
  console.log("ENtered serialize");
  var alreadyExists = false;
  var newTopicName = user.emails[0].value;
  var topicName = newTopicName.replace("@", "-");
  topicName = topicName.replace(".","-");
  MongoClient.connect(url, function(err, db) {
    db.collection('Users').updateOne({
      "userId" : user.id},
      {"userId" : user.id,
      "userName" : user.displayName,
      "userFirstName" : user.name.givenName,
      "userEmail" : user.emails[0].value,
      },
      { upsert : true } , function(err, result) {
      if(err) throw err;
    });
    var params = {
    };
    sns.listTopics(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
          //console.log("Topics " + data.Topics[0].TopicArn);
          for(i = 0 ; i < data.Topics.length ; i++)
          {
            //console.log(data.Topics[i].TopicArn.split(":")[5]);
            if(data.Topics[i].TopicArn.split(":")[5] == topicName) {
              alreadyExists = true;
            }
          }
          if(!alreadyExists){
            params = {
              Name: topicName /* required */
            };
            sns.createTopic(params, function(err, data) {
              if (err) console.log(err); // an error occurred
              else
              {
                //console.log("Topic created " + data.TopicArn);
                var subscribeparams = {
                  Protocol: 'email', /* required */
                  TopicArn: data.TopicArn, /* required */
                  Endpoint: user.emails[0].value
                };
                sns.subscribe(subscribeparams, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else     console.log("Sent subscribe request " + data.SubscriptionArn );           // successful response
                });
              }          // successful response
            });

          }
        }            // successful response
    });
  });
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  MongoClient.connect(url, function(err, db) {
    db.collection('Users').findOne({
      "userId" : id}, function(err, result) {
      if(err) throw err;
        console.log(result);
        done(null,result);
    }); 
  });
});


app.route('/refresh').post(function(arg, res, next) {
  var query;
  query = arg.query;
    
  return async.series([
    (function(_this) {
      return function(done) {
        return e.similars.update(query.user, done);
      };
    })(this), (function(_this) {
      return function(done) {
        return e.suggestions.update(query.user, done);
      };
    })(this)
  ], (function(_this) {
    return function(err) {
      if (err != null) {
        return next(err);
      }
      //return res.redirect("/?user=" + query.user);
      return res.redirect("/home");
    };
  })(this));
});

app.route('/like').post(function(arg, res, next) {
  var query;
  query = arg.query;
  if (query.unset === 'yes') {
    return e.likes.remove(query.user, query.game, (function(_this) {
      return function(err) {
        if (err != null) {
          return next(err);
        }
        //return res.redirect("/?user=" + query.user);
        return res.redirect("/home");
      };
    })(this));
  } else {
    return e.dislikes.remove(query.user, query.game, (function(_this) {
      return function(err) {
        if (err != null) {
          return next(err);
        }
        return e.likes.add(query.user, query.game, function(err) {
          if (err != null) {
            return next(err);
          }
          //return res.redirect("/?user=" + query.user);
          return res.redirect("/home");
        });
      };
    })(this));
  }
});

app.route('/dislike').post(function(arg, res, next) {
  var query;
  query = arg.query;
  if (query.unset === 'yes') {
    return e.dislikes.remove(query.user, query.game, (function(_this) {
      return function(err) {
        if (err != null) {
          return next(err);
        }
        //return res.redirect("/?user=" + query.user);
        return res.redirect("/home");
      };
    })(this));
  } else {
    return e.likes.remove(query.user, query.game, (function(_this) {
      return function(err) {
        if (err != null) {
          return next(err);
        }
        return e.dislikes.add(query.user, query.game, function(err) {
          if (err != null) {
            return next(err);
          }
          //return res.redirect("/?user=" + query.user);
          return res.redirect("/home");
        });
      };
    })(this));
  }
});

app.get('/', function(req, res, next) {
  res.sendfile('./AuthApp/index.html');
});


app.get('/SendNotification', function(arg, res, next) {
   var name = "", owner = "", ownerEmail= "", gameName = "";
             if (typeof(arg.param('name'))!=="undefined")
                name = arg.param('name');
    console.log(name);
    var userName = arg.user.userFirstName;
    var userEmail = arg.user.userEmail;
    gameName = name.split(',')[0];
    ownerEmail = name.split(',')[1];
    console.log(ownerEmail);
    owner = name.split(',')[2];
    var topicName = ownerEmail.replace("@", "-");
    topicName = topicName.replace(".","-");
    var targetTopic = "" + topicName;
    console.log(targetTopic);
    var message = "Hey " + owner + "\n" + userName + " is interested in purchasing the game " + gameName+ " that you put up on GameReco. Please reach out to the interested buyer at " + userEmail + ". \n Thanks, GameReco Team"; 
    var params = {
        Message: message,
        Subject: 'GameReco Game Interest',
        TargetArn: targetTopic
      };
      sns.publish(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log("Publish happened" + data);           // successful response
      });
    
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope: 'email', authType: 'reauthenticate'}));

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
  successRedirect: '/home',
  failureRedirect: '/error'
}));

app.get('/success', function(req, res, next) {
  res.send('Successfully logged in.');
});

app.get('/error', function(req, res, next) {
  res.send("Error logging in.");
});

app.route('/home').get(function(arg, res, next) {
  var user = arg.user.userFirstName;
  var email  = arg.user.userEmail;
  //  games = require('./data/games.json');
  reload.load('./data/games.json', function (err, data) {
    // do stuffconsole.log(games);
    games = data;
    //console.log("Query " + user);
    return async.auto({
      likes: (function(_this) {
        return function(done) {
          return e.likes.itemsByUser(user, done);
        };
      })(this),
      dislikes: (function(_this) {
        return function(done) {
          return e.dislikes.itemsByUser(user, done);
        };
      })(this),
      suggestions: (function(_this) {
        return function(done) {
          return e.suggestions.forUser(user, function(err, suggestions) {
            if (err != null) {
              return done(err);
            }
            return done(null, _.map(_.sortBy(suggestions, function(suggestion) {
              return -suggestion.weight;
            }), function(suggestion) {
              return _.findWhere(games, {
                id: suggestion.item
              });
            }));
          });
        };
      })(this)
    }, (function(_this) {
      return function(err, arg1) {
        var dislikes, likes, suggestions;
        likes = arg1.likes, dislikes = arg1.dislikes, suggestions = arg1.suggestions;
        //Code for content based filtering goes here. Merge it with collaborative filtering.
        //console.log("likes : ");
        //console.log(likes);
        
        //console.log("number of suggestions : " + suggestions.length);
        //console.log("likes : " + likes[2]);
        //suggestions.push(2);
        var newSugg;
        var fileContent = './data/content.json';
        var readContent = JSON.parse(fs.readFileSync(fileContent,'utf8'));
        var fileGames = './data/games.json';
        var readGames = JSON.parse(fs.readFileSync(fileGames,'utf8'));
        var sortedGames = "";
        //console.log("readContent : ");
        //console.log(readContent[0].recommendedGames[0]);
        for(k=0;k<readContent.length;k++)
        {
          if(readContent[k].userEmail == email)
          {
            //console.log(readContent[k].userEmail)
            //console.log(globalUserEmail)
            //console.log(readContent[k].recommendedGames[0]);
            //var tmp = JSON.stringify(readContent[k]);
            //console.log("tmp : ");
            //console.log(tmp);
            //console.log("NEW RECOMMENDATION");
            //console.log(readContent[k]);
                        
            suggestions.push(readContent[k]);
            //break;
          }
        }
        var indices = 0;
        var len = suggestions.length;
        readGames.sort(function(a,b){
            var x = (a.count > b.count)? -1 : 1;
            return x;
          });
        var limit = 5;
        //console.log("sorted games json is : ");
        //console.log(readGames);
        for(a = len; a < limit; a++)
        {
          //var sortedGames = sortJSON(readGames,"count");
          
          //console.log("sorted games json is : ");
          //console.log(readGames);
          suggestions.push(readGames[indices]);
          indices = indices + 1;
          //console.log("len is : ")
          //console.log(len);
        }
        //suggestions.reverse();
//console.log("suggestions : ");
            //console.log(suggestions);
//console.log("number of suggestions : " + suggestions.length);

        if (err != null) {
          return next(err);
        }
        MongoClient.connect(url, function (err, db) {
db.open(function(err,db){ // <------everything wrapped inside this function
         db.collection('ads', function(err, collection) {
             //arg.param('q')
             var q = "";
             if (typeof(arg.param('q'))!=="undefined")
                q = arg.param('q');
             collection.find({ $or: [ {"game_name":{ $regex: new RegExp("^" + q.toLowerCase(), "i") }},{"game_platform":{$regex: new RegExp("^" + q.toLowerCase(), "i") }},{"game_price":{ $regex: new RegExp("^" + q.toLowerCase(), "i") }}, {"game_location":{ $regex: new RegExp("^" + q.toLowerCase(), "i") }}]}).toArray(function(err, items) {
                 //console.log(items);
            
                  return res.render('index2', {
                  games: games,
                  user: user,
                  emailid: email,
                  user1: {name:user, id:email},
                  adss : items,
                  likes: likes,
                  dislikes: dislikes,
                  suggestions: suggestions.slice(0, 4)
                  //suggestions: suggestions
                });             
             });
         });
     });

    });
      };
    })(this));
  });
});
app.get('/logout', function(req, res) {
  req.session = null;
  req.user = null;
  res.redirect('/');
});

app.get('/postad', function(req, res) {
    res.sendfile('./views/newad.html');
});

app.post('/api/deleteads', function(req, res) {
    MongoClient.connect(url, function (err, db) {
        if (err) {
          //console.log('Unable to connect to the mongoDB server. Error:', err);
        }
        else {
        //console.log('Connection established to', url);
        }
        db.collection('ads').remove( { "_id": ObjectId(req.body.id)}, function(err, result) {
                if(err) throw err;
                //console.log("Deleted-ad");
                res.json({'message':'success'});     
        });
    });
});



app.post('/api/insertAds',function(req,res) {
  var CheckFlag = 0;
    var replacementofUser = req.user.userFirstName;
    var replacementofEmail = req.user.userEmail;
  MongoClient.connect(url, function (err, db) {
    if (err) {
      //console.log('Unable to connect to the mongoDB server. Error:', err);
    }
    else {
    console.log('Connection established to', url);
    var gameurl = "http://thegamesdb.net/api/GetGame.php?name=" + req.body.name;
    var suggestionGameUrl = "http://www.giantbomb.com/api/search/?query=" + req.body.name+ "&resources=game&api_key=&field_list=name,api_detail_url&limit=5"
    jj = xmlToJson(gameurl, function(err, data) {
      if (err) {
        return console.err(err);
      }
      var gameData = JSON.stringify(data, null, 2);
      var json = JSON.parse(gameData);
      var json2 = JSON.stringify(json);
      var json3 = JSON.parse(json2);
      var json4 = JSON.stringify(json3);
      var index = 0;
      var flag = 0;
      if(json3.Data.Game == null)
      {
        res.redirect('/home');
      }
      else{
       
      for(i = 0 ; i < json3.Data.Game.length ; i++)
      {
        if(json3.Data.Game[i].GameTitle.toString().toLowerCase() == req.body.name.toString().toLowerCase())
        {
            index = i;
            flag = 1;
            break;
        }
      }
      var newId = json3.Data.Game[index].id;
      var newGameTitle = json3.Data.Game[index].GameTitle;
      var newImageUrl1 = json3.Data.baseImgUrl;
      var newImageUrl2 = json3.Data.Game[index].Images[0].boxart[0]['$'].thumb;
      var newImageUrl = newImageUrl1 + newImageUrl2;
      var description = json3.Data.Game[index].Overview;
      var genres = json3.Data.Game[index].Genres;
      var detailedDescription = "";
      var genre = "";

      if(genres != null)
      {
          genre = genres[0].genre[0];
      }
      if(description != null)
      {
          detailedDescription = description;
      }
      var rating = json3.Data.Game[index].Rating;
      var id = newId[0].toString();
       var GameTitle = newGameTitle[0].toString();
       var newGame =  { "thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : detailedDescription  , "count" : 1 , "genre" : genre, "rating" : rating } ;
      var jsonfile = require('jsonfile')
      var util = require('util')
      var file = './data/games.json';
      var obj = JSON.parse(fs.readFileSync(file,'utf8'));
      var count = 1;
      var exists = false;
      for (var i = 0; i < obj.length; i++){
        if (obj[i].id == newId){
          obj[i].count += 1 ;
          count = obj[i].count;
          exists = true;
        }
      }
      if(!exists)
      {
      obj.push(newGame);
      }
      db.collection('ads').insertOne( { "thumb": { "url":newImageUrl }, "game_name" : req.body.name, "game_owner" : replacementofUser, "game_platform" : req.body.platform, "game_owner_email":replacementofEmail, "game_price" : req.body.price, "game_location" : req.body.location }, function(err, result) {
            if(err) throw err;
            //console.log("Updated");
      });
      db.collection('games').updateOne(
        {"id" : id },
        {
          "thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : detailedDescription  , "count" : count , "genre" : genre, "rating" : rating
        },
        { upsert : true } , function(err, result) {
        if(err) throw err;
        //console.log("Updated");
      });
      jsonfile.writeFile(file, obj, function (err) {
        console.error(err);
      

    });


    console.log("Before sugestions");
    yy = xmlToJson(suggestionGameUrl, function(err, data) {
      if (err) {
        return console.err(err);
      }
      var gameData = JSON.stringify(data, null, 2);
      var json = JSON.parse(gameData);
      var json2 = JSON.stringify(json);
      var json3 = JSON.parse(json2);
      var newId = json3.response.results[0].game[0].name[0];
      //console.log(newId);
      var getSuggestedGamesUrl = json3.response.results[0].game[0].api_detail_url[0] + "?api_key=&field_list=similar_games&limit=5";
      zz = xmlToJson(getSuggestedGamesUrl, function(err, data) {
        if (err) {
          // Handle this however you like
          return console.err(err);
        }

        var gameData = JSON.stringify(data, null, 2);
        var json = JSON.parse(gameData);
        var json2 = JSON.stringify(json);
        var json3 = JSON.parse(json2);
        if(json3.response.results[0].similar_games[0])
        {
        var newId = json3.response.results[0].similar_games[0].game[0].name[0];
        db.collection('Users').updateOne({
          "userEmail" : replacementofEmail},
          {
            $push : { "recommendedGames" : newId }
          },
          function(err, result) {
          if(err) throw err;
          //console.log("Updated recommended Games");
          });
        }
    var gameurl = "http://thegamesdb.net/api/GetGame.php?name=" + newId;
    jj = xmlToJson(gameurl, function(err, data) {
      if (err) {
        return console.err(err);
      }
      var gameData = JSON.stringify(data, null, 2);
      var json = JSON.parse(gameData);
      var json2 = JSON.stringify(json);
      var json3 = JSON.parse(json2);
      var json4 = JSON.stringify(json3);
      if(json3.Data.Game == null)
      {
        res.redirect('/home');
      }
      else{
      var newId = json3.Data.Game[0].id;
      var newGameTitle = json3.Data.Game[0].GameTitle;
      var newImageUrl1 = json3.Data.baseImgUrl;
      var newImageUrl2 = json3.Data.Game[0].Images[0].boxart[0]['$'].thumb;
      var newImageUrl = newImageUrl1 + newImageUrl2;
      var description = json3.Data.Game[0].Overview;
      var genres = json3.Data.Game[0].Genres;
      var rating = json3.Data.Game[0].Rating;
      var detailedDescription = "";
      var genre = "";
      if(genres != null)
      {
          genre = genres[0].genre[0];
      }
      if(description != null)
      {
          detailedDescription = description;
      }
      var id = newId[0].toString();
      var GameTitle = newGameTitle[0].toString();
      var newGame =  { "thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : detailedDescription  , "count" : 1 , "genre" : genre, "rating" : rating } ;
      var newRecGame =  { "userEmail" : replacementofEmail,"thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : detailedDescription  , "count" : 1 , "genre" : genre, "rating" : rating } ;
      var jsonfile = require('jsonfile')
      var util = require('util')
      var file2 = './data/games.json';
      var file3 = './data/content.json';
      var obj3 = JSON.parse(fs.readFileSync(file3,'utf8'));
      var obj2 = JSON.parse(fs.readFileSync(file2,'utf8'));
      var count = 0;
      var exists = false;
      obj3.push(newRecGame);
      for (var i = 0; i < obj2.length; i++){
        if (obj2[i].id == newId){
          count = obj2[i].count;
          exists = true;
        }
      }
      if(!exists)
      {
      obj2.push(newGame);
      }
      
      db.collection('games').updateOne(
        {"id" : id },
        {
          "thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : description  , "count" : count , "genre" : genre, "rating" : rating
        },
        { upsert : true } , function(err, result) {
        if(err) throw err;
        //console.log("Updated");
      });
          /*db.collection('ContentRec').updateOne({
          "userEmail" : globalUserEmail},
          {
            //$push : { "recommendedGames" : newId }
            $push : { "recommendedGames" : {"thumb": { "url":newImageUrl },"id":id, "name":GameTitle , "description" : description  , "count" : count , "genre" : genres[0].genre[0], "rating" : rating}
          }
          },{ upsert : true } , function(err, result) {
        if(err) throw err;
        console.log("Updated");
          });*/

      /*db.collection('Users').updateOne({
          "userEmail" : globalUserEmail},
          {
            $push : { "recommendedGameId" : id }
          },
          function(err, result) {
          if(err) throw err;
          console.log("Updated recommended Games");
          });*/
    
      jsonfile.writeFile(file3, obj3, function (err) {
        console.error(err);
      });
      jsonfile.writeFile(file2, obj2, function (err) {
        console.error(err);
        res.redirect('/home');
      });
    }

    });
      });
    });
    }
  });
    }
    
  });
});

function xmlToJson(url, callback) {
  var req = http.get(url, function(res) {
    var xml = '';

    res.on('data', function(chunk) {
      xml += chunk;
    });

    res.on('error', function(e) {
      callback(e, null);
    });

    res.on('timeout', function(e) {
      callback(e, null);
    });

    res.on('end', function() {
      parseString(xml, function(err, result) {
        callback(null, result);
      });
    });
  });
}


app.listen((process.env.PORT || 8081), function(err) {
  if (err != null) {
    throw err;
  }
  return console.log("Listening on " + port);
});

// ---
// generated by coffee-script 1.9.2
