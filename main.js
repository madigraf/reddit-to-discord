const fs = require('fs');
const fswfp = require('fs-writefile-promise');
const fsrfp = require('fs-readfile-promise');
const snoowrap = require('snoowrap');
const Discord = require('discord.js');


var client_secret = require('./client_secret.json');

const rclient = new snoowrap({
	userAgent: client_secret.reddit_userAgent,
	clientId: client_secret.reddit_clientId,
	clientSecret: client_secret.reddit_clientSecret,
	username: client_secret.reddit_username,
	password: client_secret.reddit_password
});

var lastID = -1;
var oldlastID = -1;
const targettedSub = client_secret.reddit_subreddit;
const targettedChannel = client_secret.discord_channel;
const threadLimit = client_secret.reddit_threadlimit;

var interval;
const routineFrequency = client_secret.routine_frequency;

const fileName = client_secret.file_name;

const dclient = new Discord.Client();


dclient.on('ready', () => {
  console.log('I am ready!');
  dclient.channels.get(targettedChannel).send('I am ready!');
});

//for a quick latency/freeze check while running
dclient.on('message', message => {
  if (message.content === 'ping') {
    message.reply('pong');
  }
});

//runs postNew ever routineFrequency milliseconds
function schedulePulls() {
    interval = setInterval(postNew, routineFrequency);
}

//api pull, posts on discord if reddit posts were younger than the last post to discord
//unfortunately the api does not support filtering threads by time
var infoDump = function (){
  return new Promise(function(resolve, reject){
    rclient.getSubreddit(targettedSub).getNew({limit: threadLimit})
    .then(function(backwardsPosts){
      return backwardsPosts.reverse();
    })
    .then(function(posts){
      var t = lastID;
      posts.forEach(function(post){
        if(post.created_utc > t){
          dclient.channels.get(targettedChannel).send(postDescriptionString(post));
          lastID = post.created_utc;
        }
      }
    )})
    .finally(function(){
      resolve(lastID);
    });
  });
}

var initalizeRedditFetch = function (){
  //1. read from file to get lastID
  //2. if read fails, use current UTC time and save to file
  return new Promise(function(resolve, reject){
    fs.readFile(fileName, 'utf8', function(err, data){
      if(err || data == ''){
        //handle
        lastID = Math.floor((new Date()).getTime() / 1000);
        saveLastID();

      }
      else{
        lastID = Number(data);
      }
      resolve(lastID);
    });
  });
}

//write lastID to the file
var saveLastID = function(){
  return new Promise(function(resolve, reject){
    fs.writeFile(fileName, lastID.toString(), function(err){
            if(err){
              dclient.channels.get(targettedChannel).send("File write error");
            }
            else{
              oldlastID = lastID;
            }            
          } );
  });
}

//formatting function for discord post
function postDescriptionString(post){
  return "`New post from " + post.subreddit_name_prefixed + "`\n\n"
    + "**" + post.title + "** " + "*by " + post.author.name + "*\n" 
    + "**Thread**\n" + "https://www.reddit.com" + post.permalink + "\n**Link**\n"
    + post.url + "\n";
}

//main function
function postNew(){
        infoDump()
        .then(function(){
          if(oldlastID != lastID){
            saveLastID();
          }
        });
}
 
dclient.login(client_secret.discord_token);

initalizeRedditFetch().then(schedulePulls());