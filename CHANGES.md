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

* feat(duplicates): duplicates are now grouped rather than added at the end of the list.
* feat(duplicates): do not display the library ID for duplicates.
* feat(duplicates): the red background for duplicates have been faded to improve the lisibility.
* feat: do not round anymore the file sizes.
* feat: the media is now split in 2 parts: the _files_ (stored in the library itself) and  _linked_  files (stored outside the library).

v0.30.0
-------

* feat: copy  directories using hard links for files bigger than 2KB.
* fix(backup): Copy the `Motion Templates` directory of the library.
* feat(backup): the internal files (stored in `Original Media`) are no longer saved into the `Folders` directory avoiding the creation of a _fake_ library.

v0.50.0
-------

* feat: Paths are abreviated if they exceed a specific length.
* feat: better display of objects especially in special cases.
* feat: added the "FCPX backups" list.
* fix: when the backup can start _before_ the FCPBackup disk has been found.
* fix: can copy source directories with ".localized" extnsion (but without the extension).

v0.60.0
-------

* refactor: integration of React for optimization (includes WebPack).
* refactor: code is not changed and React not used.
* fix: a direct usage of 'fcpxLibraries' in the function "refreshDisplay()"
* fix: plain JS errors reported by Webpack.
* NOTE: this version does not include any enhancements but is a rewrite to use React in the next version.
* refactor: removed jQuery usage in `fcpx-renderer.js`
