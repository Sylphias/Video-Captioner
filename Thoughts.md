Okay it works. However there are some issues I'd like to tackle with the way we do styling to make it look more  
seamless. Lets remove the styling tab and rename the two remaining tabs as Timeline view / Text Edit View

- Lets have styling as a sliding out drawer from the right side. It should appear when we click a "Global styling button"
- The overrides for each speaker should occur when we click on an edit button (lets remove the x and put in a pencil and a delete button for each row)
- Then there is a phrase level override as well that occurs when we click a particular phrase (the side panel appears for that phrase)

Lets also add a new phase where we add in an text animation creator that will enable us to create animations for standard vertical and horizontal resolutions videos and store them (either in a local db or some file to be re-used again)

ok, here are several more issues

- Instead of pushing in the next phrase below the previous phrase when a different speaker speaks. We should just retain the same height for the original speaker, and put the new phrase coming in into the new space
- We need a phrase length field to allow us to quickly split/join all the phrases together across the whole timeline (this is because when enlarging the text to be readable, it now goes out of the video's frames.)
- When clicking on the timeline with the audio waves, we should be able to seek to that position in the video
- Currently the video's timing and controls are blocking the view of the rendered text. Could we shift them out of the preview? (maybe place them below the preview)

Another issue with the text:

The next text is pushing the previous text upwards (if say two people are speaking over one another)

Instead of that I want The speaker's whose text first appears not to move, but for the incoming speaker's text to be positioned elsewhere instead. If the first speaker's text disappears then the next text that overlaps should fill up their space

A row is a just an abitrary unit of space in the video

X - speaker 1 text
Y - SPeaker 2 text

### Current Behaviour

_Frame1_
Sub row 3 :
Sub row 2 :
Sub row 1 : XXXX

_Frame2_
Sub row 3 :
Sub row 2 : XXXX
Sub row 1 : YYYY

_Frame3_
Sub row 3 :
Sub row 2 :
Sub row 1 : YYYY

### Expected behaviour

_Frame1_
Sub row 3 :
Sub row 2 :
Sub row 1 : XXXX

_Frame2_
Sub row 3 :
Sub row 2 : YYYY
Sub row 1 : XXXX

_Frame3_
Sub row 3 :
Sub row 2 : YYYY
Sub row 1 :

_Frame4_
Sub row 3 :
Sub row 2 : YYYY
Sub row 1 : XXXX

If more speakers are speaking we just have more rows (or spaces)
