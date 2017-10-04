/*
 * Copyright (c) 2017 EITA Cooperative
 *
 * @author Vinicius Brand <vinicius@eita.org.br>
 * @author Daniel Tygel <daniel@eita.org.br>
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */
(function() {
	/**
	 * @class OCA.Circles.FileList
	 * @augments OCA.Files.FileList
	 *
	 * @classdesc Circles file list.
	 * Contains a list of files filtered by circles
	 *
	 * @param $el container element with existing markup for the #controls
	 * and a table
	 * @param [options] map of options, see other parameters
	 * @param {Array.<string>} [options.circlesIds] array of system tag ids to
	 * filter by
	 */
	var FileList = function($el, options) {
		this.initialize($el, options);
	};
	FileList.prototype = _.extend({}, OCA.Files.FileList.prototype,
		/** @lends OCA.Circles.FileList.prototype */ {
		id: 'circlesfilter',
		appName: t('circles', 'Circles\' files'),

		/**
		 * Array of system tag ids to filter by
		 *
		 * @type Array.<string>
		 */
		_circlesIds: [],
		_lastUsedTags: [],

		_clientSideSort: true,
		_allowSelection: false,

		_filterField: null,

		/**
		 * @private
		 */
		initialize: function($el, options) {
			OCA.Files.FileList.prototype.initialize.apply(this, arguments);
			if (this.initialized) {
				return;
			}

			if (options && options.circlesIds) {
				this._circlesIds = options.circlesIds;
			}

			OC.Plugins.attach('OCA.Circles.FileList', this);

			var $controls = this.$el.find('#controls').empty();

			this._initFilterField($controls);
		},

		destroy: function() {
			this.$filterField.remove();

			OCA.Files.FileList.prototype.destroy.apply(this, arguments);
		},

		_initFilterField: function($container) {
			var self = this;
			this.$filterField = $('<input type="hidden" name="circles"/>');
			$container.append(this.$filterField);
			this.$filterField.select2({
				placeholder: t('circles', 'Select circles to filter by'),
				allowClear: false,
				multiple: true,
				toggleSelect: true,
				separator: ',',
				query: _.bind(this._queryCirclesAutocomplete, this),

				id: function(circle) {
					return circle.unique_id;
				},

				initSelection: function(element, callback) {
					var val = $(element).val().trim();
					if (val) {
						var circleIds = val.split(','),
							circles = [];

						OCA.Circles.api.listCircles("all", '', 1, function(result) {
							_.each(circleIds, function(circleId) {
								var circle = _.find(result.data,function(circleData) {
									return circleData.unique_id == circleId;
								});
								if (!_.isUndefined(circle)) {
									circles.push(circle);
								}
							});

							callback(circles);
						});

					} else {
						callback([]);
					}
				},

				formatResult: function (circle) {
					return circle.name;
				},

				formatSelection: function (circle) {
					return circle.name;
					//return OC.SystemTags.getDescriptiveTag(tag)[0].outerHTML;
				},

				sortResults: function(results) {
					results.sort(function(a, b) {
						var aLastUsed = self._lastUsedTags.indexOf(a.id);
						var bLastUsed = self._lastUsedTags.indexOf(b.id);

						if (aLastUsed !== bLastUsed) {
							if (bLastUsed === -1) {
								return -1;
							}
							if (aLastUsed === -1) {
								return 1;
							}
							return aLastUsed < bLastUsed ? -1 : 1;
						}

						// Both not found
						return OC.Util.naturalSortCompare(a.name, b.name);
					});
					return results;
				},

				escapeMarkup: function(m) {
					// prevent double markup escape
					return m;
				},
				formatNoMatches: function() {
					return t('systemtags', 'No tags found');
				}
			});
			this.$filterField.on('change', _.bind(this._onTagsChanged, this));
			return this.$filterField;
		},

		/**
		 * Autocomplete function for dropdown results
		 *
		 * @param {Object} query select2 query object
		 */
		_queryCirclesAutocomplete: function(query) {

			OCA.Circles.api.listCircles("all", query.term, 1, function(result) {
				query.callback({
					results: result.data
				});
			});
			/*
			 OC.SystemTags.collection.fetch({
			 success: function() {
			 var results = OC.SystemTags.collection.filterByName(query.term);

			 query.callback({
			 results: _.invoke(results, 'toJSON')
			 });
			 }
			 });
			 */
		},

		/**
		 * Event handler for when the URL changed
		 */
		_onUrlChanged: function(e) {
			if (e.dir) {
				var circles = _.filter(e.dir.split('/'), function(val) { return val.trim() !== ''; });
				this.$filterField.select2('val', circles || []);
				this._circlesIds = circles;
				this.reload();
			}
		},

		_onTagsChanged: function(ev) {
			var val = $(ev.target).val().trim();
			if (val !== '') {
				this._circlesIds = val.split(',');
			} else {
				this._circlesIds = [];
			}

			this.$el.trigger(jQuery.Event('changeDirectory', {
				dir: this._circlesIds.join('/')
			}));
			this.reload();
		},

		updateEmptyContent: function() {
			var dir = this.getCurrentDirectory();
			if (dir === '/') {
				// root has special permissions
				if (!this._circlesIds.length) {
					// no tags selected
					this.$el.find('#emptycontent').html('<div class="icon-systemtags"></div>' +
						'<h2>' + t('systemtags', 'Please select tags to filter by') + '</h2>');
				} else {
					// tags selected but no results
					this.$el.find('#emptycontent').html('<div class="icon-systemtags"></div>' +
						'<h2>' + t('systemtags', 'No files found for the selected tags') + '</h2>');
				}
				this.$el.find('#emptycontent').toggleClass('hidden', !this.isEmpty);
				this.$el.find('#filestable thead th').toggleClass('hidden', this.isEmpty);
			}
			else {
				OCA.Files.FileList.prototype.updateEmptyContent.apply(this, arguments);
			}
		},

		getDirectoryPermissions: function() {
			return OC.PERMISSION_READ | OC.PERMISSION_DELETE;
		},

		updateStorageStatistics: function() {
			// no op because it doesn't have
			// storage info like free space / used space
		},

		reload: function() {
			if (!this._circlesIds.length) {
				// don't reload
				this.updateEmptyContent();
				this.setFiles([]);
				return $.Deferred().resolve();
			}

			this._selectedFiles = {};
			this._selectionSummary.clear();
			if (this._currentFileModel) {
				this._currentFileModel.off();
			}
			this._currentFileModel = null;
			this.$el.find('.select-all').prop('checked', false);
			this.showMask();
			this._reloadCall = this.filesClient.getFilteredFiles(
				{
					circlesIds: this._circlesIds
				},
				{
					properties: this._getWebdavProperties()
				}
			);
			if (this._detailsView) {
				// close sidebar
				this._updateDetailsView(null);
			}
			var callBack = this.reloadCallback.bind(this);
			return this._reloadCall.then(callBack, callBack);
		},

		reloadCallback: function(status, result) {
			if (result) {
				// prepend empty dir info because original handler
				result.unshift({});
			}

			return OCA.Files.FileList.prototype.reloadCallback.call(this, status, result);
		}
	});

	OCA.Circles.FileList = FileList;
})();

