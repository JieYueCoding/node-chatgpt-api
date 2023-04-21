// @version 0.0.6 新增 429 限频场景下的兼容
import * as lark from "@larksuiteoapi/node-sdk";

// 如果你不想配置环境变量，或环境变量不生效，则可以把结果填写在每一行最后的 "" 内部
const FEISHU_APP_ID = process.env.FEI_APPID || ""; // 飞书的应用 ID
const FEISHU_APP_SECRET = process.env.FEI_SECRET || ""; // 飞书的应用的 Secret
const FEISHU_BOTNAME = process.env.FEI_BOTNAME || ""; // 飞书机器人的名字

const client = new lark.Client({
  appId: FEISHU_APP_ID,
  appSecret: FEISHU_APP_SECRET,
  disableTokenCache: false,
});

// 回复消息
async function reply(messageId, content) {
  try {
    return await client.im.message.reply({
      path: {
        message_id: messageId,
      },
      data: {
        content: JSON.stringify({
          text: content,
        }),
        msg_type: "text",
      },
    });
  } catch (e) {
    logger("send message to feishu error", e, messageId, content);
  }
}

// 自检函数
async function doctor() {
  if (FEISHU_APP_ID === "") {
    return {
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的 AppID，请检查 & 部署后重试",
        en_US: "Here is no FeiSHu APP id, please check & re-Deploy & call again",
      },
    };
  }
  if (!FEISHU_APP_ID.startsWith("cli_")) {
    return {
      code: 1,
      message: {
        zh_CN: "你配置的飞书应用的 AppID 是错误的，请检查后重试。飞书应用的 APPID 以 cli_ 开头。",
        en_US: "Your FeiShu App ID is Wrong, Please Check and call again. FeiShu APPID must Start with cli",
      },
    };
  }
  if (FEISHU_APP_SECRET === "") {
    return {
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的 Secret，请检查 & 部署后重试",
        en_US: "Here is no FeiSHu APP Secret, please check & re-Deploy & call again",
      },
    };
  }

  if (FEISHU_BOTNAME === "") {
    return {
      code: 1,
      message: {
        zh_CN: "你没有配置飞书应用的名称，请检查 & 部署后重试",
        en_US: "Here is no FeiSHu APP Name, please check & re-Deploy & call again",
      },
    };
  }

  return {
    code: 0,
    message: {
      zh_CN: "✅ Configuration is correct, you can use this bot in your FeiShu App",
      en_US: "✅ 配置成功，接下来你可以在飞书应用当中使用机器人来完成你的工作。",
    },
    meta: {
      FEISHU_APP_ID,
      OPENAI_MODEL,
      OPENAI_MAX_TOKEN,
      FEISHU_BOTNAME,
    },
  };
}

let chat;

export default async function (params, client, settings) {
  chat = client;
  const check = await fCheck(params);
  if (check.code === 0) {
    const message_id = params.event.message.message_id;
    const userInput = JSON.parse(params.event.message.content);
    const text = userInput.text.replace("@_user_1", "");
    logger(`message_id:${message_id}`);
    onChatGPT(message_id, text);
  } else {
    console.info("fCheck", check);
    return check;
  }
}

let conversationId = undefined;
let parentMessageId = undefined;
let conversationSignature = undefined;
let clientId = undefined;
let invocationId = undefined;

async function onChatGPT(messageId, text) {
  let result;
  try {
    let res = "";
    let code = 0;
    result = await chat.sendMessage(text, {
      conversationId,
      parentMessageId,
      conversationSignature,
      clientId,
      invocationId,
      onProgress: (token) => {
        process.stdout.write(token);
        res += token;
        if (res.endsWith("\n\n") || res.endsWith("[DONE]")) {
          code = res.split("```").length - 1;
          if (code != 1) {
            reply(messageId, res.replace("\n\n", ""));
            res = "";
          }
        }
      },
    });
    conversationId = result.conversationId;
    parentMessageId = result.messageId;
    conversationSignature = result.conversationSignature;
    clientId = result.clientId;
    invocationId = result.invocationId;
  } catch (e) {
    console.log(`\n❌: sendMessageError:${e}`);
    await reply(messageId, "🤖️: AI机器人摆烂了，请稍后再试～");
  }
}

// function write(text, data) {
//   text = text.replace(/\n|\r/g, "");
//   data = data.replace(/\n|\r/g, "");
//   const ws = fs.createWriteStream("sample.txt", { flags: "a" });
//   ws.once("open", function () {});
//   ws.once("close", function () {});
//   ws.write(`\n${text}:${data}`);
//   ws.end();
// }

let eventId;

async function fCheck(params) {
  // 如果存在 encrypt 则说明配置了 encrypt key
  if (params.encrypt) {
    logger("user enable encrypt key");
    return {
      code: 1,
      message: {
        zh_CN: "你配置了 Encrypt Key，请关闭该功能。",
        en_US: "You have open Encrypt Key Feature, please close it.",
      },
    };
  }
  // 处理飞书开放平台的服务端校验
  if (params.type === "url_verification") {
    logger("deal url_verification");
    return {
      challenge: params.challenge,
    };
  }
  // 自检查逻辑
  if (!params.hasOwnProperty("header")) {
    logger("enter doctor");
    return await doctor();
  }
  // 处理飞书开放平台的事件回调
  if (params.header.event_type === "im.message.receive_v1") {
    // 对于同一个事件，只处理一次
    if (eventId == params.header.event_id) {
      logger("deal repeat event");
      return { code: 1 };
    }
    eventId = params.header.event_id;

    // 私聊直接回复
    if (params.event.message.chat_type === "p2p") {
      // 不是文本消息，不处理
      if (params.event.message.message_type != "text") {
        logger("skip and reply not support");
        return {
          code: 1,
          message: {
            zh_CN: "暂不支持其他类型的提问。",
            en_US: "You have open Encrypt Key Feature, please close it.",
          },
        };
      }
      return { code: 0 };
    }

    // 群聊，需要 @ 机器人
    if (params.event.message.chat_type === "group") {
      // 这是日常群沟通，不用管
      if (!params.event.message.mentions || params.event.message.mentions.length === 0) {
        logger("not process message without mention");
        return { code: -1 };
      }
      // 没有 mention 机器人，则退出。
      if (params.event.message.mentions[0].name != FEISHU_BOTNAME) {
        logger("bot name not equal first mention name ");
        return { code: -1 };
      }
      return { code: 0 };
    }
  }

  logger("return without other log");
  return {
    code: 2,
  };
}

function logger(param) {
  console.warn(`[FS]`, param);
}
