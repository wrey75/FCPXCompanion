import React from "react";
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { EraserFill, BoxArrowUpRight } from 'react-bootstrap-icons';
import Button from 'react-bootstrap/Button'
import Spinner from 'react-bootstrap/Spinner';
import ProgressBar from 'react-bootstrap/ProgressBar';
import { shellOpen, deleteEventDirectory } from "./fcpx-scanner";
import logo from './application-logo.png';


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


const LostEventFiles = ({ event }) => {
    if (event.lost.length == 0) {
        return (<></>);
    }
    return (<p>{event.name}
        {event.lost.map(f => <React.Fragment key={f.name}>
            <br />
            <span className="text-secondary">{f.name}</span>
            <small> (<span className="text-danger">{f.path}</span>)</small>
        </React.Fragment>
        )}
    </p>)
};

const LostFiles = ({ lib }) => {
    return (<div>
        {lib.events.map(e => (<LostEventFiles key={e.name} event={e} />))}
    </div>);
}

const LibraryContents = ({ infos }) => {
    if (!infos) {
        console.warn("NO DATA AVAILABLE.");
        return (<></>);
    } else if (infos.fcpxLibraries.length == 0) {
        return (<div>{infos.found > 0 ? `${infos.found} libraries to scan...`: 'No library found yet.'}</div>);
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
            const classNames = 'list-group-item' + (lib.duplicated ? ' duplicateLib' : (lib.backup !== 0 ? ' backup' + lib.backup : ''));
            const theKey = lib.libraryID + (lib.duplicated ? '_' + (++countDuplicates) : '');
            const proxySizeStr = diskSize(lib.proxySize);
            const renderSizeStr = diskSize(lib.renderSize);
            const totalMediaStr = diskSize(lib.totals.media);
            const linkSizeStr = diskSize(lib.totals.linkSize);
            var classColor = '';
            if (lib.lost.length > 0) {
                classColor = 'text-danger';
            } else if (lib.backup == 3) {
                // classColor = 'text-success';
            } else if (lib.backup == 0) {
                classColor = 'text-muted';
            }
            return (<li key={theKey} className={classNames}>
                {lib.duplicated ? '' : <><small><code>{lib.libraryID}</code></small><br /></>}
                <b>{lib.name}</b>
                &nbsp;<a onClick={() => { shellOpen(lib.path) }}><BoxArrowUpRight /></a>
                &nbsp;<small>({eventText})</small><br />
                <small>{lib.path}</small><br />
                <small>
                    {lib.proxySize == 0 ? 'No transcoded media. ' : (<>Transcoded: <b>{proxySizeStr}&nbsp;<a className="text-warning" href="#" onClick={() => {
                        deleteEventDirectory(lib.index, 'Transcoded Media');
                    }}><EraserFill /></a></b></>)}
                    {lib.renderSize > 0 ? <> Rendered: <b>{renderSizeStr}
                        <a className="text-warning" href="#" onClick={() => deleteEventDirectory(lib.index, 'Render Files')}>&nbsp;<EraserFill /></a>
                    </b></> : <> No rendered media. </>}
                    <span className={classColor}>
                        &nbsp;Media: <b>{totalMediaStr}</b> ({lib.totals.fileCount} files)
                        {lib.totals.linkCount < 1 ? '' : <> +&nbsp;<b>{linkSizeStr}</b> ({lib.totals.linkCount} links)</>}
                    </span>
                </small>
                {totalLost < 1 ? '' : <span className="text-danger"> and {totalLost} lost</span>}
                {(totalLost > 0 && !lib.duplicated) ? <LostFiles lib={lib} /> : ''}
            </li>);
        })}
    </ul>);
}

const AutosaveList = ({ autosaved }) => {
    if (!autosaved || autosaved.list.length < 1) {
        return <div>No libraries autosaved by Final Cut Pro found.</div>
    }
    return (<div style={{ "whiteSpace": 'nowrap' }}>
        {autosaved.list.map(x => <small key={x.index}>{x.path}<br /></small>)}
    </div>);
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
                {x.lost > 0 ? (<React.Fragment><span className="text-danger"><strong>Missing {x.lost} files</strong></span></React.Fragment>) : ''}
                {x.notLost > 0 ? (<small> (but {x.notLost} still there)</small>) : ''}
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
                    <tr><td>Libraries backuped:</td><td>{props.backup.done}</td></tr>
                    <tr><td>Libraries to backup:</td><td>{props.backup.total}</td></tr>
                    <tr><td>Files already backuped:</td><td>{props.totalBackuped}</td></tr>
                    <tr><td>Files to backup:</td><td>{props.totalToBackup}</td></tr>
                </React.Fragment>);
            }
        }
        return (
            <table>
                <tbody>
                    <tr><td>Scanned directories:</td><td>{props.scannedDirs}</td></tr>
                    <tr><td>Total of directories:</td><td>{props.totalDirs}</td></tr>
                    <tr><td>Registered files:</td><td>{props.filesInMap}</td></tr>
                    <tr><td>Library found:</td><td>{props.found}</td></tr>
                    <tr><td>Step:</td><td>{props.step}</td></tr>
                    <tr><td>Progress:</td><td>{props.progress}</td></tr>
                    {backupInfo}
                </tbody>
            </table>
        );
    }
}

const App = ({ status }) => {
    if (!status) {
        return (<div>Initialising...</div>);
    }
    var backupTab = '';
    var backupAlert = '';
    if(status.backup){
        backupTab = (<Tab eventKey="backups" title="Backups"><BackupContents infos={status}></BackupContents></Tab>);
    } else {
        backupAlert = <React.Fragment><br/><div className="alert alert-warning" role="alert">Backup disk <strong>FCPSlave</strong> not detected. You must have attach
        a disk with this name to have your backuped.</div></React.Fragment>;
    }
    return (
        <div className="container">
            <div className="row align-items-start">
                <div className="col-2"><img src={logo} className="img-fluid" /></div>
                <div className="col">
                    <h1>FCPX Companion</h1>
                    <ProgressBar animated={!status.done} now={status.progress} />
                    <p><span id="scanText">{status.message}</span></p>
                    {backupAlert}
                </div>
            </div>
            <div style={{paddingTop: '6pt'}}></div>
            <Tabs>
                <Tab eventKey="library" title={'Librairies (' + status.fcpxLibraries.length + ')'}>
                    <LibraryContents infos={status} />
                </Tab>
                {backupTab}
                <Tab eventKey="autosave" title={'Auto saved (' + status.autosave.list.length + ')'}>
                    <AutosaveList autosaved={status.autosave} />
                </Tab>
                <Tab eventKey="infos" title="Informations">
                    <InformationData props={status}></InformationData>
                    {/*<DebugInfo data={status} ></DebugInfo>*/}
                </Tab>
            </Tabs>
            <p style={{textAlign: 'center', fontSize:'75%', paddingTop: '18pt'}}>
                Initiated by the <a target="_blank" href="https://www.cameraclubgeneve.ch/">Caméra Club de Genève</a>.
            </p>
        </div>
    );
}

export default App;