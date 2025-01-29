# Word Salad v0.1.0

## The What
"Word Salad" is a **text-to-speech application** with a **twist**: instead of using speech synthesis, it instead uses **sentence mixing**. By providing pre-recorded words as individual files, "Word Salad" is able to assemble sentences to play back as audio. Perfect for Twitch redeems and the like! 

## The Why
Text-to-speech is a common redeem that I see on many channels. However, I feel that the open-ended nature encourages chatters to say whatever intrusive thought crosses their mind, with little concern for length or disruption. By restricting the pool of available words, "Word Salad" presents the chatter with a fun puzzle. Thus, to say anything coherent at all feels like a small victory, and figuring out how to convey your desired sentiment requires critical thinking. It's good exercise for the mind and soul.

## The How
This application is powered by Node.js in an Electron shell for the frontend.

If you're running this via an executable file, you can skip this section.

If you're building this from source, you will need:
- [Node.js](https://nodejs.org/en)
- [npm](https://www.npmjs.com/)

From there, fire up terminal and run good old `npm install`. Then, you can launch the application with `npm start`. This should fire up Electron and open a window with the UI.

You can also package it into a portable executable file yourself by running `npm run build`, which will output into the `dist` folder. This process uses [electron.build](https://www.electron.build/).

## Adding Words
Obviously, I can't ship this application pre-filled with audio that I don't own, so you'll have to create your own Word Banks. To do this, follow these steps:

1. Click the green plus icon next to the World Banks dropdown to create a new Word Bank.
    - You can also just rename the default, empty Word Bank.
2. Select your new Word Bank from the dropdown if it isn't already. 
    - **Important note!** Observe that your bank has a display name, and also Bank ID. This ID will be formatted like `5ea7fc19-5be6-4d62-85d4-1ef80f8fdeb7`. You will need this ID later when making Speak commands.
    - You can rename your Word Bank at any time, but the ID will remain constant.
2. Create a folder and populate it with audio files. 
    - File names must be formatted as `word_number.wav`. The filename informs the application what each word is. For example, `the_02.wav` represents a variant of the word `the`. 
    - Subfolders within main folder folder are allowed.
3. Click the *"Select File Folder"* button to navigate to the folder where your audio files are stored. This should automatically populate your Word List.

If you're looking for a good jumping-off point, I found the [Wikipeda List of the 100 most common words in the English Language](https://en.wikipedia.org/wiki/Most_common_words_in_English) to be a useful guide in determining which words were most important to find and add to the Word Bank from my chosen source.

## Making It Speak
The application has two components: the Main App and the Browser Source. Once you have populated your Word Bank folder as outlined in the previous section, you can make the application speak by following these steps:
1. Add the speaker as a Browser Source to your OBS Scene with the URL `http://localhost:8095/speaker`. Be sure to check the box allowing OBS to control the Audio of this source!
    - **Important note!** `8095` is the default port. If you change the Port Number in your Settings, be sure to update the URLs of your Browser Sources.
    - If you start OBS before starting this application in the future, you may need to refresh your Browser Source. Without the Main App running first, the Browser Source can't be served.
    - It is recommended to go into "*Advanced Audio Settings*" and enable "Monitor and Output" for this Browser Soruce's audio in OBS.
2. Issue a speak command to the Main App by sending a `GET` request to `http://localhost:8095/speak?bank=<Bank ID>&phrase=<your sentence here>`. 
    - For example, with a Word Bank with Bank ID `5ea7fc19-5be6-4d62-85d4-1ef80f8fdeb7` and the desired phrase `You dense Diglett!`, your request would be `http://localhost:8095/speak?bank=5ea7fc19-5be6-4d62-85d4-1ef80f8fdeb7&phrase=You dense Diglett!`
    - You can hit this URL in any browser to issue the command, or use the Main App's UI.
3. If you had Audio Monitor enabled, you should have heard the phrase play, provided that the words you wanted to say exist in your Word Bank!

## Setting Up Twitch Redeems
The current version of "Word Salad" doesn't actually feature any direct Twitch integration at all! Instead, you can use it in tandem with a Channel Manager like [MixItUp](https://mixitupapp.com/) by following these steps:

1. Create a Channel Point Redeem via the [Twitch Dashboard](dashboard.twitch.tv).
    - Make sure to check the "*Require Viewer to Enter Text*" box.
2. In MixItUp, edit the new Channel Point redeem by adding an action that issues a Web Request to `http://localhost:8095/speak?bank=<Bank ID>&phrase=$message`.
    - The [`$message`](https://wiki.mixitupapp.com/en/commands/event-commands#twitch-channel-points-redeemed) variable in MixItUp passes the content of the redeem's text to the Web Request.
3. Get the list of words your chatters can use by going to `http://localhost:8095/banks/<Bank ID>/words`. It is recommended that you take this list and put it somewhere publicly accessible. Your homepage, your Twitch bio, wherever works!

You can set up different redeems for different Word Banks by repeating the above steps with different Bank IDs!

## Troubleshooting

This app was envisioned and constructed in about two weeks by **[Tom "Skeletom" Farro](https://www.skeletom.net)**. It's entirely possible that something doesn't work, or there's a setup step he forgot to document. Please **feel free** to reach out to him on social media or via [email](mailto:tom@skeletom.net) if you encounter any issues!