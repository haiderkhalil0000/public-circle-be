const { Server } = require("socket.io");

const { User } = require("../models");
const { authenticate } = require("../middlewares");
const {
  constants: { SOCKET_CHANNELS },
} = require("../utils");
// const sendErrorReportToSentry = require("../utils/send-error-report-to-sentry");

const connections = {};

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: "*" } });
  registerEvents();
};

const emitMessage = ({ socketObj, socketChannel, message }) => {
  socketObj.emit(socketChannel, message);
};

const registerEvents = () => {
  io.use(async (socket, next) => {
    if (socket.handshake.query && socket.handshake.query.token) {
      try {
        const token = socket.handshake.query.token;

        const { _id: userId } = authenticate.decodeToken(token);

        const user = await User.findById(userId).lean();

        if (!user) {
          return next(new Error("Not authenticated, profile not found!"));
        }

        const oldConnection = connections[user._id.toString()];

        if (oldConnection) {
          emitMessage({
            socketObj: oldConnection,
            socketChannel: SOCKET_CHANNELS.DISCONNECT_OLD_DEVICE,
            message: SOCKET_MESSAGES.LOGIN_FROM_OTHER_DEVICE,
          });
        }

        connections[user._id.toString()] = socket;

        socket.user = user;

        next();
      } catch (err) {
        // sendErrorReportToSentry(err);
        console.log(err);

        return next(
          new Error("Not authenticated, token could not be decoded!")
        );
      }
    }
  }).on(SOCKET_CHANNELS.CONNECTION, (socket) => {
    socket.on(SOCKET_CHANNELS.DISCONNECT, async () => {
      const connectionKeys = Object.keys(connections);
      const connectionValues = Object.values(connections);
      let socketIndexesToBeRemoved = [],
        socketIdToBeRemoved;

      connectionValues.forEach((item, index) => {
        if (item.id === socket.id) {
          socketIndexesToBeRemoved.push(index);
        }
      });

      for (let index of socketIndexesToBeRemoved) {
        socketIdToBeRemoved = connectionKeys[index];

        delete connections[socketIdToBeRemoved];
      }
    });
  });
};

const getSocket = ({ userId }) => connections[userId];

module.exports = { initializeSocket, emitMessage, getSocket };
