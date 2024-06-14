import fs from "fs";
import path from "path";
import http from "http";

import cors from "cors";
import express from "express";
import { EventEmitter } from "events";
import bodyParse from "body-parser";

import { KeepAlive, sse, sendSeeType } from "./utils";

const publicDir = path.join(__dirname, "..", "public");

const app = express();
const server = http.createServer(app);
const event = new EventEmitter();
let port = +(process.env.PORT || 5090);

let lave = new Date();
let stopTime: Date | undefined = void 0;

try {
  const tmp = fs.readFileSync("tmp", "utf8");
  let lave_;

  [, lave_, stopTime] = (
    tmp.match(/([0-9]+)(?:;stop=([0-9]+|undefined)?;?)/) || []
  ).map((_) => (!Number.isNaN(+_) && new Date(+_)) || void 0);

  lave = lave_ || lave;
  console.log(lave_?.getTime(), lave.getTime(), stopTime);
} catch {
  fs.writeFileSync("tmp", lave.getTime().toString());
}
const updateTmpFile = () => {
  fs.writeFileSync(
    "tmp",
    lave.getTime().toString() + `;stop=${stopTime?.getTime()}`
  );
};

event
  .on("update", updateTmpFile)
  .on("stop", updateTmpFile)
  .on("continue", () => {
    if (!stopTime) return;

    lave.setTime(
      lave.getTime() + (new Date().getTime() - new Date(stopTime).getTime())
    );

    updateTmpFile();
    stopTime = void 0;
  });

app
  .use(bodyParse.urlencoded({ extended: true }))
  .use(bodyParse.text())
  .use(bodyParse.json())
  .use(cors())
  .get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "config.html"));
  })
  .post("/", (req, res) => {
    addTime(req.body);
    res.sendStatus(200);
  })
  .get(
    "/time",
    (req, res, next) => {
      if (req.accepts("html")) {
        res.sendFile(path.join(publicDir, "time.html"));
      } else next();
    },
    sse,
    (_req, res_) => {
      const res = <typeof res_ & { json: sendSeeType; send: sendSeeType }>res_;
      const keepAlive = new KeepAlive(() => res.json("", "ping"));

      const sendNewTime = (time?: Date) => {
        res.send((time || lave).getTime().toString(), "update");
      };
      const sendStop = () => res.send("", "stop");
      const sendContinue = () => res.send("", "continue");

      res.setHeader("Access-Control-Allow-Origin", "*");
      keepAlive.start();

      stopTime && sendStop();
      sendNewTime();

      event
        .on("update", sendNewTime)
        .on("stop", sendStop)
        .on("continue", sendContinue);

      res.on("close", () => {
        keepAlive.stop();
        event
          .removeListener("update", sendNewTime)
          .removeListener("stop", sendStop)
          .removeListener("continue", sendContinue);
      });
    }
  );

server
  .on("error", (error_) => {
    const error = <Error & { code: string; syscall: string }>error_;

    if (error.syscall !== "listen") throw error;

    const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;
    console.log(error);

    switch (error.code) {
      case "EACCES":
        console.error(`${bind} 需要更高權限`);
        process.exit(1);
      // eslint-disable-next-line no-fallthrough
      case "EADDRINUSE":
        console.error(`${bind} 已使用`);
        console.log("嘗試使用其他端口...");

        server.listen(++port);
        break;
      default:
        throw error;
    }
  })
  .on("listening", () => {
    console.log("Server is running");
    console.log(`http://localhost:${port}`);
  });

server.listen(port);

export const addTime = (data: string) => {
  const [mark, time] = data.split(":");

  console.log(mark, time || "");

  if (mark === "+") lave.setTime(lave.getTime() + +time);
  else if (mark === "-") lave.setTime(lave.getTime() - +time);
  else if (mark === "stop" && !stopTime) {
    stopTime = new Date();
    event.emit("stop", stopTime);
  } else if (mark === "continue" && stopTime) event.emit("continue");

  event.emit(
    "update",
    stopTime
      ? new Date(
          lave.getTime() + (new Date().getTime() - new Date(stopTime).getTime())
        )
      : lave
  );
};
