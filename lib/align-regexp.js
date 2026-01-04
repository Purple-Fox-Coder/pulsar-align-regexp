'use babel';

import { CompositeDisposable } from 'atom';
import AlignRegexpView         from './align-regexp-view';
import alignLines              from './align-lines';

export default {
  subscriptions: null,

  activate(state) {
    this.subscriptions   = new CompositeDisposable();
    this.alignRegexpView = new AlignRegexpView(state && state.history);

    this.modalPanel = atom.workspace.addBottomPanel({
      item: this.alignRegexpView,
      visible: false
    });
    this.alignRegexpView.on('align', this.executeAlign.bind(this));
    this.alignRegexpView.on('cancel', () => this.cancel());

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'align-regexp:align-selection': () => this.alignSelection()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
    this.alignRegexpView.destroy();
  },

  serialize() {
    return {
      history: this.alignRegexpView.history
    };
  },

  alignSelection() {
    this.modalPanel.show();
    this.alignRegexpView.getEditorElement().focus();
  },

  realignSelection() {
    this.executeAlign(this.lastRegexp);
  },

  executeAlign(regexpString) {
    this.cancel();
    if (!regexpString) {
      return;
    }

    let flags = '';
    const extractFlagsRegex = /([g|i|m|u|y]+): ?(.+)/;

    const flagsMatch = extractFlagsRegex.exec(regexpString);
    if (flagsMatch) {
      regexpString = flagsMatch[2];
      flags        = flagsMatch[1];
    }

    let regexp;
    try {
      regexp = new RegExp(regexpString, flags);
    } catch (e) {
      const notification = atom.notifications.addError(`Invalid regexp ${regexpString}`);
      setTimeout(() => notification.dismiss(), 500);
      return;
    }

    const editor          = atom.workspace.getActiveTextEditor();
    const line_ending     = editor.getBuffer().getPreferredLineEnding();
    const selections      = editor.getSelections();
    const is_multi_cursor = selections.length > 1;

    selections.forEach(selection => {
      // From https://github.com/Purple-Fox-Coder/pulsar-align-regexp/issues/1
      // We want to send the full line for every line so that it aligns everything
      // as expected.  This does not apply to multi cursor selections since they
      // will usually not be highlighting the full line (if they do I give it
      // to the user to figure out)
      if (!is_multi_cursor) {
        let range = selection.getBufferRange();
        range.start.column = 0;
        selection.setBufferRange(range);
      }

      const aligned = alignLines(selection.getText(), regexp, {line_ending});
      editor.setTextInBufferRange(selection.getBufferRange(), aligned);
    });

    this.alignRegexpView.addToHistory(regexpString);
  },

  cancel() {
    this.modalPanel.hide();
    atom.workspace.getActivePane().activate();
  }
};
