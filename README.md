# FCPXCompanion

This program is used to manage FCPX librariries which is not so easy. This software has been made 
to help users to delete proxy files and other rendered files not to be kept when you have finished your work.
But, in addition, the FCPX Companion is dedicated to backup your libraries efficiently.

## What's inside a FCPX library?

A FCPX library is a bundle with the extension `.fcpbundle` used since a long time. In fact a bundle is a bunch
of files. Inside a library, you find several files to store your media (the main thing to backup), the cache, 
and the transcoded files (both the proxy 
files and other files to enhance the work of the FCPX software). In addition, you have the events and, in events,
projetcs.

Each library has also an unique identifier (a 
[UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier)). This library ID is used by FCPX Companion
to check library duplicates.

## Backups

To backup a library efficiently, you have to backup:

- The file `CurrentVersion.plist` which contains information on the version of the FCPX used.
- The file `Settings.plist` which contains the information about the library itself (it's unique ID for example)
- The `Motion Templates` diretory and its contents (note this directory is usually empty because the directory is
  also available at the uer's level where the added templates are set. 
- The events which are basically directories directly stored inside the library folder.


In each event, you have to save:

- the _media files_ (stored in the directory `Original Media` directory.
- the _linked media_ stored anywhere on the disk. The linked files are [symbolic links](https://en.wikipedia.org/wiki/Symbolic_link)
  which could not resolve under many circumstances. You have _linked media_ when you do not store the files directly in the library.
- the `CurrentVersion.fcpevent` file which contains the information about the event
- the projects information (which is also a file named `CurrentVersion.fcpevent` available in each directory which represents a project.

FCPX Companion saves all of the data above (_including_ the linked media) to guarantee you have complete backups of your libraries.

## How it works?

The software will first scan all your attached devices (included external disks of course) and try to find FCPX librairies. When a
library is found, the library is scanned and added to the list of avaiable libraries on the screen with some information. Note
the software tries to avoid special directories like _Time Machine_ backups to avoid duplicates.

When this part has been done, and the backup disk is connected, then the backup starts by adding the missing media files and
updating the library files to have the last version of your library *with all the media contents*.

This is all.

## The backup disk

As for the _Time Machine_, a dedicated disk is expected. This disk MUST be named `FCPBackup`. If not, the software consider the disk
as a normal disk.

When a disk having this special name has been found, a directory named `BackupStore` is created. Inside this folder, you will find 3
directories:

- `Libraries` is the diretory where your libraries are backuped. Each library backuped contains all the media files and other data.
- `Folders` contains _linked media_. If you have linked media in a library, the link will be found here. If the media are stored in
  the library, the original file is NOT stored there. Note the files stored there are only copies and can be deleted without any
  troubleshoot.
- `Files` is an internal directory containing stuff *you MUST NEVER copy, modfify, delete or try to read*. Any alteration in this
  directory can create serious issues.

The backup disk is optimized (the same way as the _Time Machine_) to avoid losing disk space and the same files are NOT duplicated
and, even if they are used on multiple libraries, only the version is stored.

*IMPORTANT*: the backup disk MUST be formatted with a Mac-OS format: [APFS](https://en.wikipedia.org/wiki/Apple_File_System) or
Mac OS Extended (also known as [HFS+](https://en.wikipedia.org/wiki/HFS_Plus)). The Mac OS Extended is preferred for mechanical
hard drives.

## Backups from FCPX

FCPX (Final Cut Pro X, not FCXP Companion) make regular backups of you work. But only of your work, FCPX does NOT save the media
files. These backups are usually named from the name of the library as folder name and the folder contains FCPX libraries
have a date as name.

These backups are ignored by FCPX Companion. 

## Frequent issues

As the software tries its best to do backups, there are sometimes issues you encounter. Here the list of issues you surely 
will have a day or another.



### Duplicate libraries

Well, a library has a unique ID. If you copy a library, you have a duplicate. At this moment, the software does not know what
it the correct library because there is no possibility to check what is thhe correct (or the original) one.

You have to manually delete the copy if the two libraries are exact copies or to merge the two libraries to have only one.

You can have duplicate libraries if you have made backups manually. But in this case, there is no way to know the 




  
