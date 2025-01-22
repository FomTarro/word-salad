# Word Salad v 0.1

## The What
"Word Salad" is a text-to-speech application with a twist: instead of using speech synthesis, it instead uses sentence mixing. By providing pre-recorded words as individual files, "Word Salad" is able to assemble sentences to play back as audio. Perfect for Twitch redeems and the like! 

## The Why
Text-to-speech is a common redeem that I see on many channels. However, I feel that the open-ended nature encourages people to say whatever intrusive thought crosses their mind, with little concern for length or disruption. By restricting the pool of available words, "Word Salad" presents the chatter with a fun puzzle; to say anything coherent at all feels like a small victory. It's good for the mind and soul.

## The How
This application is powered by Node.js in an Electron shell for the frontend.

If you're building this from source, you will need:
- Node.js
- npm

From there, fire up terminal and run good old `npm install`. Then, you can launch the application with `npm start`. This should fire up Electron and open a window.

Obviously, I can't ship this application pre-filled with audio I don't own, so you'll have to supply your own word bank. Kindly place your audio files in `public/words`, with the filename formatted as `<word>_<index>.wav`. The filename informs the application what the word is. For example, `the_02.wav` represents a variant of the word `the`. Subfolders within the `public/words` folder are allowed.