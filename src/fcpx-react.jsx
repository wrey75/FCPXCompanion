import React from "react";
import { EraserFill, BoxArrowUpRight } from 'react-bootstrap-icons';
import { shellOpen, deleteEventDirectory } from "./fcpx-scanner";



function diskSize(bytes) {
    // console.log("diskSize("+bytes+")")
    if (bytes === 0) {
        return "0";
    } else if (bytes > 1024 * 1024 * 100) {
        return Number.parseFloat(bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    } else if (bytes > 1024 * 100) {
        return Number.parseFloat(bytes / 1024 / 1024).toFixed(1) + ' MB';
    } else {
        return Number.parseFloat(bytes / 1024).toFixed(1) + ' KB';
    }
}

const DebugInfo = ({ data }) => {
    return (
        <div style={{ background: "red", color: "white" }}>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}

const LostFiles = ({lib}) => {
    return (<ul>
        {lib.events.map((x) => <p>{x.name}<small>
            {x.lost.map(f => <React.Fragment>
                <br/>
                <span className="text-secondary">{f.name}</span>
                <small> (<span className="text-danger">{f.path}</span>)</small>
                </React.Fragment>
            )}
            </small></p>)}
    </ul>);
}

const LibraryContents = ({ infos }) => {
    if (!infos) {
        console.warn("NO DATA AVAILABLE.");
        return (<></>);
    } else if (infos.fcpxLibraries.length == 0) {
        return (<div>No library found yet.</div>);
    }
    var countDuplicates = 0;
    return (<ul className="list-group">
        {infos.fcpxLibraries.map(lib => {
            var eventText = 'no event';
            if (lib.events.length > 1) {
                eventText = lib.events.length + " events";
            } else if (lib.events.length == 1) {
                eventText = "one event";
            }
            const mediaSize = lib.totals.media + lib.totals.linkSize;
            const links = lib.totals.linkCount;
            const totalLost = lib.totals.lost;
            const classNames = 'list-group-item' + (lib.duplicated ? ' duplicateLib' : '');
            const theKey = lib.libraryID + (lib.duplicated ? '_' + (++countDuplicates) : '');
            const proxySizeStr = diskSize(lib.proxySize);
            const renderSizeStr = diskSize(lib.renderSize);
            const totalMediaStr = diskSize(lib.totals.media);
            const linkSizeStr = diskSize(lib.totals.linkSize);
            var classColor = '';
            if (lib.lost.length > 0) {
                classColor = 'text-danger';
            } else if (lib.backup == 2) {
                classColor = 'text-success';
            } else if (lib.backup == 0) {
                classColor = 'text-muted';
            }
            return (<li key={theKey} className={classNames}>
                {lib.duplicated ? '' : <><small><code>{lib.libraryID}</code></small><br /></>}
                <b>{lib.name}</b>
                &nbsp;<a href="#" onClick={() => {shellOpen(lib.path)}}><BoxArrowUpRight/></a>
                &nbsp;<small>({eventText})</small><br />
                <small>{lib.path}</small><br />
                <small>
                {lib.proxySize == 0 ? 'No transcoded media. ' : (<>Transcoded: <b>{proxySizeStr}&nbsp;<a className="text-warning" href="#" onClick={() => {
                    deleteEventDirectory(lib.index, 'Transcoded Media');
                }}><EraserFill /></a></b></>)}
                {lib.renderSize > 0 ? <> Rendered: <b>{renderSizeStr}
                <a className="text-warning" href="#" onClick={() => deleteEventDirectory(lib.index, 'Render Files')}><EraserFill /></a>
                </b></>: <> No rendered media. </>}
                <span className={classColor}>
                    &nbsp;Media: <b>{totalMediaStr}</b> ({lib.totals.fileCount} files)
                    {lib.totals.linkCount < 1 ? '' : <> +&nbsp;<b>{linkSizeStr}</b> ({lib.totals.linkCount} links)</>}
                </span>
                </small>
                {totalLost < 1 ? '' : <span className="text-danger"> and {totalLost} lost</span>}
                {totalLost > 0 && !lib.duplicated ? <LostFiles lib ={lib} /> : ''}
            </li>);
        })}
    </ul>);
}

const BackupContents = ({ infos }) => {
    var array = [...Object.values(infos.backupStore)];
    if (array.length == 0) {
        return (<div>No backup found until now...</div>);
    }
    array.sort((a, b) => a.path.localeCompare(b.id));
    return (
        <ul className="list-group">
            {array.map((x) => (<li className="list-group-item" key={x.id}>
                <small><code>{x.id}</code></small><br />
                <small>{x.path}</small><br />
                <small>First scan: {new Date(x.first).toLocaleDateString()}
                    {x.last ? (<React.Fragment> Last seen: {new Date(x.last).toLocaleDateString()}</React.Fragment>) : ''}
                    {x.updated ? (<React.Fragment>, Last backup: {new Date(x.updated).toLocaleDateString()}</React.Fragment>) : ''}
                </small><br />
                {x.lost > 0 ? (<React.Fragment><span className="text-danger"><strong>Missing {x.lost} files</strong></span><br /></React.Fragment>) : ''}
            </li>))}
        </ul>
    )
}

const InformationData = ({ props }) => {
    if (!props) {
        console.warn("DATA NOT YET AVAILABLE");
        return (<div></div>)
    } else {
        {
            var backupInfo = (<></>);
            if (props.backup) {
                backupInfo = (<React.Fragment>
                    <tr><td>Backup Storage:</td><td>{props.backup.directory}</td></tr>
                    <tr><td>Files backuped:</td><td>{props.backup.done}</td></tr>
                    <tr><td>Files to backup:</td><td>{props.backup.total}</td></tr>
                </React.Fragment>);
            }
        }
        return (
            <table>
                <tbody>
                    <tr><td>Scanned directories:</td><td>{props.scannedDirectories}</td></tr>
                    <tr><td>Total of directories:</td><td>{props.totalDirectories}</td></tr>
                    <tr><td>Registered files:</td><td>{props.filesInMap}</td></tr>
                    {backupInfo}
                </tbody>
            </table>
        );
    }
}

const App = ({ status }) => {
    // if(!status){
    //     return (<div>Initialising...</div>);
    // }
    return (
        <div className="container">
            <h1>FCPX Companion</h1>

            <div className="progress" id="scanProgress" style={{ display: "none" }}>
                <div
                    className="progress-bar"
                    role="progressbar"
                    aria-label="Scanning files"
                    style={{ width: "50%" }}
                    aria-valuenow="75"
                    aria-valuemin="0"
                    aria-valuemax="100"
                ></div>
            </div>

            <table>
                <tbody>
                    <tr>
                        <td width="80" height="80">
                            <div id="spinner" className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </td>
                        <td>
                            <p><span id="scanText">Scanning...</span></p>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div className="row">
                <nav>
                    <div className="nav nav-tabs" id="nav-tab" role="tablist">
                        <button className="nav-link active" id="nav-library-tab" data-bs-toggle="tab" data-bs-target="#nav-library" type="button" role="tab" aria-controls="nav-library" aria-selected="true">Librairies ({status.fcpxLibraries.length})</button>
                        <button className="nav-link" id="nav-backups-tab" data-bs-toggle="tab" data-bs-target="#nav-backups" type="button" role="tab" aria-controls="nav-backups" aria-selected="false">Backups</button>
                        <button className="nav-link" id="nav-autosave-tab" data-bs-toggle="tab" data-bs-target="#nav-autosave" type="button" role="tab" aria-controls="nav-autosauve" aria-selected="false">Auto saved (<span id="fcpx-badge" >0</span>)</button>
                        <button className="nav-link" id="nav-infos-tab" data-bs-toggle="tab" data-bs-target="#nav-infos" type="button" role="tab" aria-controls="nav-infos" aria-selected="false">Informations</button>
                    </div>
                </nav>
                <div className="tab-content" id="nav-tabContent">
                    <div className="tab-pane fade show active" id="nav-library" role="tabpanel" aria-labelledby="nav-library-tab">
                        <LibraryContents infos={status} />
                    </div>

                    <div className="tab-pane fade" id="nav-backups" role="tabpanel" aria-labelledby="nav-backups-tab">
                        <BackupContents infos={status}></BackupContents>
                    </div>


                    <div className="tab-pane fade" id="nav-infos" role="tabpanel" aria-labelledby="nav-infos-tab">
                        <InformationData props={status}></InformationData>
                        <DebugInfo data={status} ></DebugInfo>
                    </div>

                    <div className="tab-pane fade" id="nav-autosave" role="tabpanel" aria-labelledby="nav-autosave-tab">
                        No FCPX backup detected right now.
                    </div>


                </div>
            </div>
        </div>
    );
}

export default App;