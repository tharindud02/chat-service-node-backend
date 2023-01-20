const app = require('express')();
const { createAdapter } = require("@socket.io/mongo-adapter");
const { MongoClient } = require("mongodb");

const formatMessage = require("./middlewares/messages");
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require("./middlewares/users");

const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
  cors: { origin: '*' }
});

const port = process.env.PORT || 3000;
const DB = "mydb";
const COLLECTION = "socket.io-adapter-events";

const mongoClient = new MongoClient("mongodb://localhost:27017/chaty_bunny", {
  useUnifiedTopology: true,
});


const main = async () => {
  await mongoClient.connect();

  const mongoCollection = mongoClient.db(DB).collection(COLLECTION);

  await mongoCollection.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 3600, background: true }
  );

  io.adapter(createAdapter(mongoCollection, {
    addCreatedAtField: true
  }));
}
main();

const botName = "Chaty Bunny";
io.on('connection', (socket) => {
  console.log('Connection Working');

  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);
    console.log(user);

    // Welcome current user
    socket.emit("message", formatMessage(botName, "Welcome to Chaty Bunny!"));

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });


  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);

    io.to(user.room).emit("message", formatMessage(user.username, msg));
  });


  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    console.log(user);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

httpServer.listen(port, () => console.log(`listening on port ${port}`)); ``