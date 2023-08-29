const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const intializeDbAndserver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
intializeDbAndserver();
const AuthenticateToken = (request, response, next) => {
  let jwtToken;
  const { tweet } = request.body;
  const { tweetId } = request.params;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "this_is_my_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweet = tweet;
        request.tweetId = tweetId;
        next();
      }
    });
  }
};
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectedQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectedQuery);
  if (dbUser === undefined) {
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createAUser = `
        INSERT INTO
           user (username,password,name,gender)
        VALUES
           ('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(createAUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
  3;
});
module.exports = app;
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectedQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectedQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const jwtToken = jwt.sign(payload, "this_is_my_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/user/tweets/feed/", AuthenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getTweets = `
  SELECT
     username,
     tweet,
     date_time AS dateTime
  FROM
    follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE
     follower.follower_user_id = ${user_id}
  ORDER BY date_time DESC
  LIMIT 4;`;
  const dbResponse = await db.all(getTweets);
  response.send(dbResponse);
});
app.get("/user/following/", AuthenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getFollowingQuery = `
    SELECT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id WHERE follower.follower_user_id = ${user_id};`;
  const dbResponse = await db.all(getFollowingQuery);
  response.send(dbResponse);
});
app.get("/user/followers/", AuthenticateToken, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const getFollowingQuery = `
    SELECT name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id WHERE follower.following_user_id = ${user_id};`;
  const dbResponse = await db.all(getFollowingQuery);
  response.send(dbResponse);
});
app.get("/tweets/:tweetId/", AuthenticateToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetResult = await db.get(tweetsQuery);
  const usersFollowersQuery = `
     SELECT * FROM follower INNER JOIN user ON user.user_id = follower.following_user_id WHERE follower.follower_user_id = ${user_id};`;
  const userFollowers = await db.all(usersFollowersQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    console.log(tweetResult);
    console.log(userFollowers);
    const tweetDetailsQuery = `
         SELECT
          tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
         FROM
           tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id = like.tweet_id
        WHERE 
           tweet.tweet_id = ${tweetId} AND tweet.user_id = ${userFollowers[0].user_id};`;
    const tweetDetails = await db.get(tweetDetailsQuery);
    response.send(tweetDetails);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
app.get(
  "/tweets/:tweetId/likes/",
  AuthenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
    const tweetResult = await db.get(tweetsQuery);
    const usersFollowersQuery = `
     SELECT * FROM follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN  like ON like.tweet_id = tweet.tweet_id INNNER JOIN user ON user.user_id = like.user-id WHERE tweet.tweet_id=${tweetId} AND follower.follower_user_id = ${user_id};`;
    const likedUsers = await db.all(usersFollowersQuery);
    console.log(likedUsers);
    if (likedUsers.length !== 0) {
      let likes = [];
      const getNamesArray = (likedUsers) => {
        for (let item of likedUsers) {
          likes.push(item.username);
        }
      };
      getNamesArray(likedUsers);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  AuthenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
    const tweetResult = await db.get(tweetsQuery);
    const usersFollowersQuery = `
     SELECT * FROM follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id INNER JOIN user ON user.user_id = reply.user_id WHERE tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id};`;
    const repliedUsers = await db.all(usersFollowersQuery);
    console.log(repliedUsers);
    if (repliedUsers.length !== 0) {
      let replies = [];
      const getNamesArray = (repliedUsers) => {
        for (let item of repliedUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliedUsers);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get("/user/tweets/", AuthenticateToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetResult = await db.get(tweetsQuery);
  const usersFollowersQuery = `
      SELECT
          tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
      FROM user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id
      WHERE user.user_id = ${user_id}
      GROUP BY tweet.tweet_id;`;

  const tweetDetails = await db.all(usersFollowersQuery);
  response.send(tweetDetails);
});
app.post("/user/tweets/", AuthenticateToken, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);
  const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const tweetResult = await db.get(tweetsQuery);
  const usersFollowersQuery = `
     INSERT INTO 
        tweet(tweet,user_id)
     VALUES(
         '${tweet}',
          ${user_id}
     );`;
  const userFollowers = await db.run(usersFollowersQuery);
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  AuthenticateToken,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
    const tweetResult = await db.get(tweetsQuery);
    const usersFollowersQuery = `
     SELECT * FROM tweet WHERE tweet.user_id = ${user_id} AND tweet.tweet_id= ${tweetId};`;
    const userFollowers = await db.all(usersFollowersQuery);
    if (tweetUser.length !== 0) {
      const deleteQuery = `DELETE FROM tweet WHERE tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
