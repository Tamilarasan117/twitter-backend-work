// Importing Third Party Packages
const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// Express Instance
const app = express()
app.use(express.json())

// Getting Database Current Full Path
const dbPath = path.join(__dirname, 'twitterClone.db')
let db = null

// Database Connection and Server Initialization
const databaseConnection = async () => {
  // Exception Handling for Handling Database Connection Error
  try {
    // Database Conncetion
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    // Assining Server Port Number
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`Database Connection Error: ${error}`)
    process.exit(1)
  }
}
databaseConnection()

// 1.Register API
app.post(`/register/`, async (request, response) => {
  const {username, password, name, gender} = request.body
  // Get User Details
  const getUserQuery = `
    select 
      *
    from
      user
    where
      username = '${username}'
  ;`
  const getUser = await db.get(getUserQuery)
  // Check User Registred / Unregistred
  if (getUser === undefined) {
    // Check Passowrd Length
    if (password.length > 6) {
      // Convert Password as Encrypted Password
      const hashedPassword = await bcrypt.hash(password, 10)
      // Register User
      const sqlQuery = `
        insert into
          user (name,username,password,gender)
        values (
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
        )
      ;`
      await db.run(sqlQuery)
      response.send('User created successfully')
    } else {
      response.status(400)
      response.send('Password is too short')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

// 2.Login API
app.post(`/login/`, async (request, response) => {
  const {username, password} = request.body
  // Get User Details
  const getUserQuery = `
    select
      *
    from
      user
    where
      username = '${username}'
  ;`
  const getUser = await db.get(getUserQuery)
  // Check User Valid / Invalid
  if (getUser !== undefined) {
    // Compare Password and Excrypted Password
    const matchPassword = await bcrypt.compare(password, getUser.password)
    if (matchPassword) {
      // Send Username as Payload Object
      const payload = {username: username}
      // Generate JWT Token and Secret Key
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      // Send JWT Token as response
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// Authentication with JWT Token Middleware Function
const authenticationMiddlewareFunction = (request, response, next) => {
  // Get Tweet and Tweet ID from request
  const {tweet} = request.body
  const {tweetId} = request.params
  // Get request header authorization
  const authorizationHeader = request.headers['authorization']
  let jwtToken = null
  // Check JWT Token
  if (authorizationHeader !== undefined) {
    // Split JWT Token
    jwtToken = authorizationHeader.split(' ')[1]
  }
  // Check JWT Token Valid / Invalid
  if (jwtToken !== undefined) {
    // Verify JWT Token with correct Secret Key after pass error and payload argument
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        // Sending User Details as Request
        request.payload = payload
        // Sending Tweet as Request
        request.tweet = tweet
        // Sending Tweet ID as Request
        request.tweetId = tweetId
        // Next Middleware / Handler
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

// 3.Returns the latest tweets of people whom the user follows API
app.get(
  `/user/tweets/feed/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload from request
    const {payload} = request
    const {username} = payload
    // Get User Details query
    const getUserDetailQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserDetail = await db.get(getUserDetailQuery)
    // Get User ID
    const {user_id} = getUserDetail
    //Get User Follows Id Query
    const getFollowingUserIdQuery = `
    select
      user.username,
      tweet.tweet,
      tweet.date_time as dateTime
    from
      follower
    inner join
      tweet
    on
      follower.following_user_id = tweet.user_id
    inner join  
      user
    on
      user.user_id = tweet.user_id
    where
      follower.follower_user_id = ${user_id}
    order by
      tweet.date_time DESC
    limit 4
    offset 0
  ;`
    const getFollowingUserTweet = await db.all(getFollowingUserIdQuery)
    response.send(getFollowingUserTweet)
  },
)

// 4.GET the list of all names of people whom the user follows API
app.get(
  `/user/following/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload from request
    const {payload} = request
    const {username} = payload
    // Get User Details query
    const getUserDetailQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserDetail = await db.get(getUserDetailQuery)
    // Get User id
    const {user_id} = getUserDetail
    // Get all names of people whom the user follows (following)
    const getFollowingUserNameQuery = `
      select
        user.name
      from
        follower
      inner join
        user
      on
        follower.following_user_id = user.user_id
      where
        follower.follower_user_id = ${user_id}
    ;`
    const getFollowingUserName = await db.all(getFollowingUserNameQuery)
    response.send(getFollowingUserName)
  },
)

// 5.GET the list of all names of people who follows the user API
app.get(
  `/user/followers/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload from request
    const {payload} = request
    const {username} = payload
    // Get user details query
    const getUserQuery = `
    select
      *
    from
      user
    where
      username = '${username}'
  ;`
    const getUser = await db.get(getUserQuery)
    // Get user id
    const {user_id} = getUser
    // Get all names of people who follows the user (follower)
    const getFollowerUserNameQuery = `
      select
        user.name
      from
        follower
      inner join
        user
      on
        follower.follower_user_id = user.user_id
      where
        follower.following_user_id = ${user_id}
    ;`
    const getFollowerUserName = await db.all(getFollowerUserNameQuery)
    response.send(getFollowerUserName)
  },
)

// 6.GET Tweet, Likes count, Replies count and Date-time API
app.get(
  `/tweets/:tweetId/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload and tweetId from request
    const {payload} = request
    const {username} = payload
    const {tweetId} = request
    // Get Tweet Id query
    const getTweetIdQuery = `
      select
        *
      from
        tweet
      where
        tweet_id = ${tweetId}
    ;`
    const getTweetId = await db.get(getTweetIdQuery)
    // Get User details query
    const getUserIdQuery = `
      select
        user_id
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Get the tweet of the user he is following
    const getFollowerUserIdQuery = `
      select
        *
      from
        follower
      inner join
        user
      on
        follower.following_user_id = user.user_id
      where
        follower.follower_user_id = ${user_id}
    ;`
    const getFollowerArray = await db.all(getFollowerUserIdQuery)
    // Check tweet of the follower and tweet if true / false
    const eachFollower = getFollowerArray.some(
      each => each.following_user_id === getTweetId.user_id,
    )
    if (eachFollower) {
      // Get first follower user id
      const userFollowerUserId = getFollowerArray[0].user_id
      // Get following user total kikes, replies and datetime query
      const getFollowingUserTLRQuery = `
        select
          tweet.tweet,
          count(DISTINCT like.like_id) as likes,
          count(DISTINCT reply.reply_id) as replies,
          tweet.date_time as dateTime
        from
          tweet
        inner join
          like
        on
          tweet.tweet_id = like.tweet_id
        inner join
          reply
        on
          reply.tweet_id = tweet.tweet_id
        where
          tweet.tweet_id = ${tweetId}
        and 
          tweet.user_id = ${userFollowerUserId}
      ;`
      const getFollowingUserTLK = await db.get(getFollowingUserTLRQuery)
      response.send(getFollowingUserTLK)
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

// 7.GET If the user requests a tweet of a user he is following, return the list of usernames who liked the tweet API
app.get(
  `/tweets/:tweetId/likes/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload and tweet id from request
    const {payload} = request
    const {username} = payload
    const {tweetId} = request.params
    // Get user details query
    const getUserIdQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Get tweet of a user he is following query
    const getFollowerUserLikesQuery = `
      select
        *
      from
        follower
      inner join
        tweet
      on 
        tweet.user_id = follower.following_user_id
      inner join
        like
      on
        like.tweet_id = tweet.tweet_id
      inner join
        user
      on
        user.user_id = like.user_id
      where
        tweet.tweet_id = ${tweetId}
      and
        follower.follower_user_id = ${user_id}
    ;`
    const getFollowerUserLikes = await db.all(getFollowerUserLikesQuery)
    // Check the tweet of the user he is following id adn check length
    if (getFollowerUserLikes.length !== 0) {
      // Array for storing liked username
      let likes = []
      // Send follower users
      const getNamesArray = getFollowerUserLikes => {
        for (let i of getFollowerUserLikes) {
          // Add liked usernames
          likes.push(i.username)
        }
      }
      // Call the function and send argument as tweet of the user he is following
      getNamesArray(getFollowerUserLikes)
      response.send({likes})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

// 8.GET If the user requests a tweet of a user he is following, return the list of replies API
app.get(
  `/tweets/:tweetId/replies/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload and tweet id from request
    const {payload} = request
    const {username} = payload
    const {tweetId} = request.params
    // Get user details query
    const getUserIdQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Get the tweet of a user he is following query
    const getFollowingUserReplysQuery = `
      select
        *
      from
        follower
      inner join
        tweet
      on 
        tweet.user_id = follower.following_user_id
      inner join
        reply
      on
        reply.tweet_id = tweet.tweet_id
      inner join
        user
      on
        user.user_id = reply.user_id
      where
        tweet.tweet_id = ${tweetId}
      and
        follower.follower_user_id = ${user_id}
    ;`
    const getFollowingUserReplys = await db.all(getFollowingUserReplysQuery)
    // Check the tweet of the user he is following id and check length
    if (getFollowingUserReplys.length !== 0) {
      // Array for storing replyed and user name and reply
      let replies = []
      // Send follower users
      const getNamesArray = getFollowingUserReplys => {
        for (let i of getFollowingUserReplys) {
          // Create Object for storing name and replys
          let usernameAndReplys = {
            name: i.name,
            reply: i.reply,
          }
          // Add liked user names and replys
          replies.push(usernameAndReplys)
        }
      }
      // Call the function and send argument as tweet of the user he is following
      getNamesArray(getFollowingUserReplys)
      response.send({replies})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

// 9.GET a list of all tweets of the user API
app.get(
  `/user/tweets/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload from request
    const {payload} = request
    const {username} = payload
    // Get user details query
    const getUserIdQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Get tweets of the user query
    const getUserTweetDetailsQuery = `
    select
      tweet.tweet,
      count(DISTINCT like.like_id) as likes,
      count(DISTINCT reply.reply_id) as replies,
      tweet.date_time as dateTime
    from
      user
    inner join
      tweet
    on
      user.user_id = tweet.user_id
    inner join
      like
    on
      like.tweet_id = tweet.tweet_id
    inner join
      reply
    on
      reply.tweet_id = tweet.tweet_id
    where
      user.user_id = ${user_id}
    group by
      tweet.tweet_id
  ;`
    const getUserTweetDetails = await db.all(getUserTweetDetailsQuery)
    response.send(getUserTweetDetails)
  },
)

// 10.Add a tweet API
app.post(
  `/user/tweets/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload and tweet from request
    const {tweet} = request
    const {payload} = request
    const {username} = payload
    // Get user details query
    const getUserIdQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Add new user tweet squery
    const addTweetQuery = `
      insert into
        tweet (tweet,user_id)
      values (
        '${tweet}',
        ${user_id}
      )
    ;`
    await db.run(addTweetQuery)
    response.send('Created a Tweet')
  },
)

// 11.Delete User Tweet API
app.delete(
  `/tweets/:tweetId/`,
  authenticationMiddlewareFunction,
  async (request, response) => {
    // Get payload and tweet id from request
    const {payload} = request
    const {username} = payload
    const {tweetId} = request
    // Get user details query
    const getUserIdQuery = `
      select
        *
      from
        user
      where
        username = '${username}'
    ;`
    const getUserId = await db.get(getUserIdQuery)
    // Get user id
    const {user_id} = getUserId
    // Get user of the tweet query
    const selectUserIdTweetIdQuery = `
      select
        *
      from
        tweet
      where
        tweet.user_id = ${user_id}
      and
        tweet.tweet_id = ${tweetId}
    ;`
    const selectUserIdTweetId = await db.all(selectUserIdTweetIdQuery)
    // Check the user of the tweet and check length
    if (selectUserIdTweetId.length !== 0) {
      // Delete user of the tweet query
      const deleteUserTweetQuery = `
      delete from
        tweet
      where
        tweet.user_id = ${user_id}
      and 
        tweet.tweet_id = ${tweetId}
    ;`
      await db.run(deleteUserTweetQuery)
      response.send('Tweet Removed')
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

// Exporting Express Instance
module.exports = app
