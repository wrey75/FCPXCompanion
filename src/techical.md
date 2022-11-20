# Technical notes

## The main code

- `fcpx-scanner.js`: This script is in charge of the stuff. Everything is made there.
- `fcpx-gui.js` is the main UI part of the program. It is based on definitions provided 
by the `index.html` file.

## Variables

### Libraries

Each library contains the following properties:

- `events`is an array of all the events stored in the library.
- `name` is the name of the library based on its path (basically the base name of the path ithout the extension).
- `proxySize` is the size used by the proxy files (including the proxies and the optimised media).
- `mediaSize` is the size used by the original media. Note for the links, only the 1KB is caculated.
- `links` is the number of links for the original media.
- `lost` is the number of original media not linked anymore to a valid media.

For each event, we store:
- `name` its name (which is basically the name of the directory)
- `size` the size of the event (I mean the original media ony and the projetcs)
- the list of `projects` (as an array of strings)
- the list of `lost` media (not linked to a valid file)



