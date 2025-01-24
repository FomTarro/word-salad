# Word Salad v 0.1

## The What
"Word Salad" is a **text-to-speech application** with a **twist**: instead of using speech synthesis, it instead uses **sentence mixing**. By providing pre-recorded words as individual files, "Word Salad" is able to assemble sentences to play back as audio. Perfect for Twitch redeems and the like! 

## The Why
Text-to-speech is a common redeem that I see on many channels. However, I feel that the open-ended nature encourages chatters to say whatever intrusive thought crosses their mind, with little concern for length or disruption. By restricting the pool of available words, "Word Salad" presents the chatter with a fun puzzle; to say anything coherent at all feels like a small victory. It's good for the mind and soul.

## The How
This application is powered by Node.js in an Electron shell for the frontend.

If you're building this from source, you will need:
- Node.js
- npm

From there, fire up terminal and run good old `npm install`. Then, you can launch the application with `npm run start`. This should fire up Electron and open a window with the UI.

You can also package it into a portable executable file by running `npm run build`, which will output into the `dist` folder.

## Adding Words
Obviously, I can't ship this application pre-filled with audio that I don't own, so you'll have to supply your own word bank. To do this, follow these steps:

1. Create a folder and populate it with audio files. 
    - File names must be formatted as `word_number.wav`. The filename informs the application what each word is. For example, `the_02.wav` represents a variant of the word `the`. 
    - Subfolders within main folder folder are allowed.
2. Click on the *"Word List"* button on the UI, then click the *"Select Word Directory"* button to navigate to the folder where your audio files are stored. 

If you're looking for a good jumping-off point, I found the [Wikipeda List of the 100 most common words in the English Language](https://en.wikipedia.org/wiki/Most_common_words_in_English) to be a useful guide in determining which words were most important to find and add to the word bank from my chosen source.

## Making It Speak
The application has two components: the UI (hereafter called the Server) and the Speaker. Once you have populated your word bank folder as outlined in the previous section, you can make the application speak by following these steps:
1. Add the Speaker as a Browser Source to your OBS Scene with the URL `http://localhost:8095/speaker`. Be sure to check the box allowing OBS to control the Audio of this source!
    - **Important note!** `8095` is the default port. If you change the Port Number in your Settings, be sure to update the URLs of your Browser Sources.
2. Issue a speak command to the Server by sending a `GET` request to `http://localhost:8095/speak?bank=Default&phrase=your sentence here`. 
    - You can hit this URL in any browser to issue the command.

## Setting Up Twitch Redeems
The current version of "Word Salad" doesn't actually feature any direct Twitch integration at all! Instead, you can use it in tandem with a Channel Manager like [MixItUp](https://mixitupapp.com/) by following these steps:

1. Create a Channel Point Redeem via the [Twitch Dashboard](dashboard.twitch.tv).
    - Make sure to check the `Require Viewer to Enter Text` box.
2. In MixItUp, edit the new Channel Point redeem by adding an action that issues a Web Request to `http://localhost:8095/speak?bank=Default&phrase=$message`.
    - The `$message` variable in MixItUp passes the content of the redeem's text to the Web Request.