CHANGES
=======

Beta release
------------

* Backup in the `FCPBackup` disk.
* Control of duplicate libraries
* Use of `store.json` for storage of library information.
* Saves the linked files in `Folders` directory of the `BackupStore`. 
* Display of lost links.

v0.20.0
-------

* feat: Added the version in the title of the window
* feat: Added a progress when copying files

v0.21.0
-------

* feat: No more indexing for the `BackupStore`
* feat: backup store goes to version 1.

v0.22.0
-------

* feat: Libraries are stored by names in the `Libraries` store.
* feat: All media files are also saved in the `Folders` store.
* feat: backup store goes to version 2.

v0.25.0
-------

* feat: backups of files found in a library are saved under the "_fcpbubdle" instead of ".fcpbundle" in `Folders`.
* feat: duplicates are now grouped rather than added at the end of the list.
* feat: do not round anymore the file sizes.
* feat: the media is now split in 2 parts: the _files_ (stored in the library itself) and  _linked_  files (stored outside the library).

