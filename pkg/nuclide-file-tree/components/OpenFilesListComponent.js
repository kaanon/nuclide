/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as React from 'react';
import classnames from 'classnames';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import FileTreeActions from '../lib/FileTreeActions';
import FileTreeHelpers from '../lib/FileTreeHelpers';
import {FileTreeStore} from '../lib/FileTreeStore';
import PathWithFileIcon from '../../nuclide-ui/PathWithFileIcon';
import {TreeList, TreeItem, NestedTreeItem} from '../../nuclide-ui/Tree';
import {track} from '../../nuclide-analytics';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

const getActions = FileTreeActions.getInstance;
const store = FileTreeStore.getInstance();

type OpenFileEntry = {
  name: string,
  uri: NuclideUri,
  isModified: boolean,
  isSelected: boolean,
};

type Props = {
  uris: Array<NuclideUri>,
  modifiedUris: Array<NuclideUri>,
  activeUri: ?NuclideUri,
};

type State = {
  hoveredUri: ?NuclideUri,
};

export class OpenFilesListComponent extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hoveredUri: null,
    };
  }

  componentDidUpdate(prevProps: Props): void {
    const selectedRow = this.refs.selectedRow;
    if (selectedRow != null && prevProps.activeUri !== this.props.activeUri) {
      // Our lint rule isn't smart enough to recognize that this is a custom method and not the one
      // on HTMLElements, so we just have to squelch the error.
      // eslint-disable-next-line rulesdir/dom-apis
      selectedRow.scrollIntoView();
    }
  }

  _onMouseDown(entry: OpenFileEntry, event: SyntheticMouseEvent<>) {
    event.stopPropagation();
    const rootNode = store.getRootForPath(entry.uri);
    if (
      FileTreeHelpers.getSelectionMode(event) === 'single-select' &&
      !entry.isSelected &&
      rootNode != null
    ) {
      getActions().setTargetNode(rootNode.rootUri, entry.uri);
    }
  }

  _onClick(entry: OpenFileEntry, event: SyntheticMouseEvent<>): void {
    if (event.defaultPrevented) {
      return;
    }

    const uri = entry.uri;

    if (event.button === 1) {
      this._closeFile(uri);
      return;
    }

    track('filetree-open-from-open-files', {uri});
    goToLocation(uri);
  }

  _onCloseClick(entry: OpenFileEntry, event: SyntheticEvent<>): void {
    const uri = entry.uri;
    event.preventDefault();
    this._closeFile(uri);
  }

  _closeFile(uri: NuclideUri): void {
    track('filetree-close-from-open-files', {uri});
    atom.workspace.getPanes().forEach(pane => {
      pane
        .getItems()
        .filter(item => item.getPath && item.getPath() === uri)
        .forEach(item => {
          pane.destroyItem(item);
        });
    });
  }

  _onListItemMouseEnter(entry: OpenFileEntry) {
    this.setState({
      hoveredUri: entry.uri,
    });
  }

  _onListItemMouseLeave = () => {
    this.setState({
      hoveredUri: null,
    });
  };

  render(): React.Node {
    const sortedEntries = propsToEntries(this.props);

    return (
      <div className="nuclide-file-tree-open-files">
        <PanelComponentScroller>
          {/* simulate a once-nested list to share styles those with others
            that require a single level of indentation */}
          <TreeList showArrows className="nuclide-file-tree-open-files-list">
            <NestedTreeItem hasFlatChildren>
              {sortedEntries.map(e => {
                const isHoveredUri = this.state.hoveredUri === e.uri;
                return (
                  <TreeItem
                    className={classnames('file', {
                      'text-highlight': isHoveredUri,
                    })}
                    selected={e.isSelected}
                    key={e.uri}
                    onClick={this._onClick.bind(this, e)}
                    onMouseEnter={this._onListItemMouseEnter.bind(this, e)}
                    onMouseLeave={this._onListItemMouseLeave}
                    onMouseDown={this._onMouseDown.bind(this, e)}
                    data-path={e.uri}
                    data-name={e.name}
                    ref={e.isSelected ? 'selectedRow' : null}>
                    <span
                      className={classnames('icon', {
                        'icon-primitive-dot': e.isModified && !isHoveredUri,
                        'icon-x': isHoveredUri || !e.isModified,
                        'text-info': e.isModified,
                      })}
                      onClick={this._onCloseClick.bind(this, e)}
                    />
                    <PathWithFileIcon path={e.displayName || e.name} />
                  </TreeItem>
                );
              })}
            </NestedTreeItem>
          </TreeList>
        </PanelComponentScroller>
      </div>
    );
  }
}

function generateDistinctNames(
  entries: Array<OpenFileEntry>,
  duplicateName: string,
): Array<OpenFileEntry> {
  const dupes = entries.filter(e => e.name === duplicateName);
  const maxLength = dupes.reduce((len, entry) => {
    return entry.uri.length > len ? entry.uri.length : len;
  }, 0);
  let i = 0; // the last matching index
  for (i; i < maxLength; i++) {
    const letter = dupes[0].uri[i];
    const isSameChar = dupes.reduce((isSame, entry) => {
      if (isSame && entry.uri[i] === letter) {
        return true;
      }
      return false;
    }, true);
    if (!isSameChar) {
      break;
    }
  }

  return entries.map(entry => {
    let displayName;
    if (entry.displayName === undefined) {
      displayName = entry.name === duplicateName ? entry.uri.substr(i) : entry.name;
    } else {
      displayName = entry.displayName;
    }
    return {
      ...entry,
      displayName,
    };
  });
}
function propsToEntries(props: Props): Array<OpenFileEntry> {
  const nameCounter = {};
  let entries = props.uris.map(uri => {
    const isModified = props.modifiedUris.indexOf(uri) >= 0;
    const isSelected = uri === props.activeUri;
    const name = FileTreeHelpers.keyToName(uri);
    nameCounter[name] = nameCounter[name] ? nameCounter[name] + 1 : 1;
    return {uri, name, isModified, isSelected};
  });

  // Remove duplicates
  for (const name in nameCounter) {
    if (nameCounter[name] > 1) {
      entries = generateDistinctNames(entries, name);
    }
  }
  entries.sort((e1, e2) =>
    e1.name.toLowerCase().localeCompare(e2.name.toLowerCase()),
  );
  return entries;
}
