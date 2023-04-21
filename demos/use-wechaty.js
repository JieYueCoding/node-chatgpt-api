// npx tsx demos/use-wechaty.js
import { BingAIClient } from "../index.js";
import wechaty from "../src/wechaty.js";

wechaty(
  new BingAIClient({
    userToken: "", // "_U" cookie from bing.com
    debug: false,
  }),
  {
    wechatyClient: {
      chatgptTriggerKeyword: process.env.WECHATY_KEYWORD || "@bot",
      botName: process.env.WECHATY_BOTNAME || "陈冠希",
    },
  }
);
