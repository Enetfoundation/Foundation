

// File to handle telegram Bot API calls

const BOT_TOKEN = process.env.TG_BOT_TOKEN;
export const sendTGBotMessage = async (tgUserId: string, message: string) => {

  try {
    // call fetch API with the correct format for the send_message
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: tgUserId,
        text: message,
      })
    });

    if (response.ok) {
      return await response.json();
    }

    throw new Error("Something went wrong trying to send bot message");

  } catch (err: any) {
    console.log(err, ":::Bot API sendMessage error");
    throw err;
  }
}
