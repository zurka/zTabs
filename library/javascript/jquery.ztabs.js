/*
* jQuery zTabs plugin
* Version 2.0.19
* @requires jQuery v1.5 or later
*
* roberson@zurka.com
*
* Considerable effort was put towards making the code understandable.  It's not.
*
*/

(function( $ ) {
	var settings = {
		subrowsdivid: false,
		contentdivid: false,
		imagebaseurl: 'library/images/',
		closebutton: false,
		fromanchor: 'a.zTab, button.zTab, input[type="button"].zTab',
		replace: 'a.zReplace',
		formreplace: 'form.zReplace',
		formresults: '.zResults',
		localstorage: true,
		refreshbutton: false,
		rowchange: false,
		initialized: false,
		
		cache: true,
		closeable: false,
		contenturl: false,
		label: false,
		maxlabelsize: false,
		onclose: false,
		oncreate: false,
		onsleep: false,
		onwake: false,
		parentid: false,
		refreshable: false,
		singleton: false
	};
	
	// This array helps performance of parse the list by focusing on the settings the tabs care about and excluding things like subrowsdivid
	var tabSettings = ['cache', 'closeable', 'contenturl', 'label', 'maxlabelsize', 'onclose', 'oncreate', 'onsleep', 'onwake', 'parentid', 'refreshable', 'singleton'];

	// initial values
	var zTabsSet = 0;
	var zTabsId = 0;
	var recentTabId = '';
	
	// lock out the other tabs when one is loading
	var clickLock = false;
	var iFrameLock = false;  // IE iFrame based history

	// Browsers shouldn't do the caching for us
	$.ajaxSetup({
		cache: false
	});
	
	var currentLocationHash = '';

	var methods = {
		init: function(options) {			
			// for IE history, add a hidden div to the top of the page
			if($.browser.msie) {
				$('body').prepend('<iframe id="zTabHistory" src="blank.html" style="display:none"></iframe>');
				$('#zTabHistory').load(function() {
					iFrameLock = false;
				});
			}
			
			return this.each(function() {
				if (options) { 
		        	$.extend(settings, options);
		      	}
	
				// Retrieve the version of localStorage.  This allows developers to changes tabIds of an existing project without leaving legacy tabs around.
				// For instance, set locakstorage: 'version2' to clear out the cache of users when they come in the next time.
				if(typeof localStorage != 'undefined') {
					if(settings.localstorage != 'ignore' && settings.localstorage !== false && settings.localstorage !== true && settings.localstorage != 'clear' && localStorage.getItem('localStorageVersion') != settings.localstorage) {
						localStorage.clear();
						localStorage.setItem('localStorageVersion', settings.localstorage);
					}
				}
	
				if (!settings.closebutton) {
					settings.closebutton = '<img width="11" height="11" border="0" src="'+settings.imagebaseurl+'close_tab_button_white.gif">';
				}
				if (!settings.refreshbutton) {
					settings.refreshbutton = '<img width="11" height="11" border="0" src="'+settings.imagebaseurl+'refresh_button.png">';
				}

				// set up anchor tabs with class zTab to be a tab
				$(settings.fromanchor).live('click', function(event) {
					event.preventDefault();				
					$(this).zTabs('fromAnchor').click();
				});
				
				$(settings.replace).live('click', function(event) {
					event.preventDefault();
					var that = this;
					$.get($(this).attr('href')).then(function(data) {
						$(that).zTabs('parentContent').html(data);
					});
				});
				$(settings.formreplace).live('submit', function(event) {
					event.preventDefault();
					var that = this;
					$.ajax($(this).attr('action'),{ type:$(this).attr('method') || 'POST', data:$(this).serialize() }).success(function(data) {
						if($(that).zTabs('parentContent', settings.formresults).length > 0) {
							$(that).zTabs('parentContent', settings.formresults).html(data);
						} else {
							$(that).zTabs('parentContent').html(data);
						}
					}).error(function() {
						alert('Ajax error');
					});
				});
				$(window).resize(function() {
					tabOverflowAll();
				});
				
				
				// the UL is storage for the tabSet wide information
				$(this).addClass('zTabs').attr('data-ztabsset', zTabsSet).attr('data-ztabsid', zTabsId);
				zTabsSet++; zTabsId++;
				for(var key in settings) {
					if(typeof $(this).data(key) == 'undefined') {
						$(this).data(key, settings[key]);
					}
				}
				
				// Get tab data from the HTML
				// Local assignments override parameters in the set up.
				parseTheList(this, 1);

				$(this).children('li').each(function() {
					// set the click, doubleClick and close button
					setUpTab(this);
				});
				
				if(settings.localstorage == 'clear') {
					$(this).zTabs('clear');
				}

				// If the hash path is set, open the appropriate tabs
				var that = this;
				if(location.hash != '') {
					$.when($(this).zTabs('showPath', location.hash)).then(function() {
						if($(that).zTabs('current') == false) {
							var ul = that;
						} else {
							var ul = $(that).zTabs('current').parent();
						}
						rebuildList(ul);
						archiveList(ul);
						initialized();
					});
				} else {
					if($(this).find('li.current, li.currentWithSecondRow').length == 1) {
						$.when(showTab($(this).find('li.current, li.currentWithSecondRow').attr('id'))).then(function() {
							var ul = $(that).zTabs('current').parent();
							rebuildList(that);
							archiveList(that);
							initialized();
						});
					} else {
						$.when(showTab($(this).find('li:first').attr('id'))).then(function() {
							if($(that).zTabs('current') == false) {
								var ul = getTabSet();
							} else {
								var ul = $(that).zTabs('current').parent();
							}
							rebuildList(ul);
							archiveList(ul);
							initialized();
						});
					}
				}
				
				// STEVE one day there should be a way to differentiate between an app tab set and other tab sets
				if(typeof hashChecker == 'undefined') {
					var hashChecker = setInterval ("$(this).zTabs('checkHash');", 100);
				}				
			});
		},
		add: function(options) {
			var dfd = $.Deferred();
		
			var options = options || {};
			
			// By default, added tabs are closeable
			if(typeof options.closeable == 'undefined' || options.closeable != false) {
				options.closeable = true;
			}
			
			if(typeof options.label == 'undefined') {
				options.label = 'Untitled';
			}
			
			if(typeof options.tabid != 'undefined') {
				var liId = options.tabid;
			} else if(typeof options.label != 'undefined') {
				var liId = uniqueId(options.label);
			} else {
				// error
				alert('Error: Adding a tab requires an id or label');
				dfd.fail('Adding a tab requires an id or label');
				return dfd.promise();
			}
			
			// Set up the label.  Truncate if appropriate			
			if(typeof options.maxlabelsize != 'undefined' && options.maxlabelsize != false && options.label.length > options.maxlabelsize) {
				var title = options.label;
				options.label = options.label.substring(0,options.maxlabelsize - 3) + "...";	
			}
			
			// This can be set as show:false or added to an li as data-show='false'
			if(typeof options.show == 'undefined') {
				options.show = true;
			}
			
			// does it already exist?  If so, show it and you're done
			var $addTab = $('#'+liId);
			if($addTab.length > 0 && options.show) {
				return $addTab.zTabs('show');
			}
		
			// if parentid is set, use that as the destination li/ul.  If it's not, use the element that precedes the add call in the chain.  (meaning this)
			if(typeof options.parentid != 'undefined' && options.parentid != false && $(cleanId(options.parentid)).length > 0) {
				var $this = $(cleanId(options.parentid));
			} else {
				var $this = $(this);
			}
		
			// if an <li> was passed in, show the tab, call zTabsAdd with the <ul>
			
			if($this.is('li')) {
				// show the tab
				if($("div[data-ztabid="+$this.data('ztabid')+"_content], ul[data-ztabid="+$this.data('ztabid')+"_content]").length > 0) {
					delete options.parentid; // we've already handed moving to the parent
					return $("div[data-ztabid="+$this.data('ztabid')+"_content], ul[data-ztabid="+$this.data('ztabid')+"_content]").zTabs('add', options);
				} else {
					$.when($this.zTabs('show')).then(function() {
						// After showing this tab, see if it has subtabs, if so, add the new tab
						if($("div[data-ztabid="+$this.data('ztabid')+"_content], ul[data-ztabid="+$this.data('ztabid')+"_content]").length > 0) {
							delete options.parentid; // we've already handed moving to the parent
							return $("div[data-ztabid="+$this.data('ztabid')+"_content], ul[data-ztabid="+$this.data('ztabid')+"_content]").zTabs('add', options);
						} else {
							dfd.resolve();
							return dfd.promise();
						}
					});
				}
			}
			
			// It's a list
			if($this.is('ul')) {
				var $tabSet = $(getTabSet());
				var newId = $tabSet.data('ztabsset')+"_"+$tabSet.data('ztabsid');
				$tabSet.data('ztabsid',  parseInt($tabSet.data('ztabsid'), 10)+1);

				var newLi = document.createElement('li');
				$newLi = $(newLi);				
				$newLi.attr({id:liId, 'data-ztabid':newId, 'data-contenturl':options.contenturl, 'data-label':options.label, 'title':title}).html("<a href='"+options.contenturl+"'>"+options.label+"</a>");

				// Go through the settings array and set any data that's not been set locally
				for(var i=0; i<tabSettings.length; i++) {
					var key = tabSettings[i];				
					if(typeof options[key] != 'undefined') {
						$newLi.data(key, options[key]);
					} else if(typeof $newLi.data(key) == 'undefined') {
						$newLi.data(key, settings[key]);
					}
				}
				// Set the position of the tab to be added
				if(typeof options.position != 'undefined' && options.position < $(this).find('li').length) {
					var position = 'li:eq('+options.position+')';
					$(this).find(position).before(newLi);
				} else {
					$(this).append(newLi);
				}

				var $newTab = $("li[data-ztabid="+newId+"]");
				// set up options
				$newTab.each(function () {
					setUpTab(this);
				});
			
				if(options.show) {
					// show the tab	
					$.when($newTab.zTabs('show')).then(function() {
						tabOverflow($newTab.parent().attr('id'),  $newTab.attr('id'));
						dfd.resolve();
					});
				} else {
					archiveList($newTab.parent().get(0));
					tabOverflow($newTab.parent().attr('id'),  $newTab.attr('id'));
					dfd.resolve();	
				}
				return dfd.promise();
			}
		},
		addAndShow: function(options) {
			// Deprecated.  Showing is now the default.
			options.show = true;
			return $(this).zTabs('add', options);
		},
		cc: function(filter) {
			if(this.selector == '') {
				var $tabSet = $(getTabSet());
			} else {
				var $tabSet = $(this);
			}
			
			// Convenience method for combining getting the current content
			var currentArray = [];
			if(typeof filter == 'undefined') {
				$tabSet.each(function() {
					currentArray.push($(this).zTabs('current').zTabs('content').get(0));
				});
			} else {
				$tabSet.each(function() {
					$tabSet.zTabs('current').zTabs('content', filter).each(function() {
						currentArray.push(this);
					});
				});
			}

			currentArray = $.unique(currentArray);
			return $tabSet.pushStack(currentArray);
		},		
		checkHash: function() {			
			if(clickLock || iFrameLock) {
				return;
			}

			if($('#zTabHistory').length > 0) {
				// we must be using an iFrame for IE history
				var newTab = $('#zTabHistory')[0].contentWindow.document.location.hash;
			} else {
				// FF, Safari, etc.
				var newTab = location.hash;
			}

			if(newTab != '#'+currentLocationHash && newTab != '') {
				this.zTabs('showPath',newTab);
			}	
		},
		clear: function(id) {
			if(typeof localStorage == 'undefined') {
				return;
			}
			// Clears out the local storage for a specific ul or for everything
			// One day this should be careful to only touch zTabs local storage
			var id = id || false;
			if(!id) {
				// clear out everything
				localStorage.clear();
			} else {
				localStorage.remove(id);
			}
		},
		close: function(force) {
			var force = force || false;
			
			// returns a promise		
			var dfd = $.Deferred();
			var ul = $(this).parent().get(0);
			
			var that = this;
			var $that = $(that);
			// call some onclose bit that is allowed to cancel
			if(checkOnCloses(that) || force) {
				// is the tab we're closing currently selected
				if($that.is('.current, .currentWithSecondRow')) {
					// if it has a child row, run the rowchange callback when this is all done
					if($that.is('.currentWithSecondRow')) {
						dfd.then(function() {
							rowChange();
						});
					}
							
					// close the tab
					removeContentForTab(that);
					// If it's hidden, don't animate the closing
					if($that.hasClass('hiddenTab')) {
						$that.remove();
						// Now find the tab to show
						if($("[data-ztabid="+recentTabId+"]").is('li')) {
							$.when($("[data-ztabid="+recentTabId+"]").zTabs('show')).then(function() {
								archiveList(ul);
								tabOverflow($(ul).attr('id'));
								dfd.resolve();
							});
						} else {
							$.when($(ul).find('li:first').zTabs('show')).then(function() {
								archiveList(ul);
								tabOverflow($(ul).attr('id'));
								dfd.resolve();
							});
						}
					} else {
						$that.addClass('disableHover').animate({'opacity':'0'}, 75).css('height','1px').animate({'width':0}, 400, function() {
							$that.remove();
							// Now find the tab to show
							if($("[data-ztabid="+recentTabId+"]").is('li')) {
								$.when($("[data-ztabid="+recentTabId+"]").zTabs('show')).then(function() {
									archiveList(ul);
									tabOverflow($(ul).attr('id'));
									dfd.resolve();
								});
							} else {
								$.when($(ul).find('li:first').zTabs('show')).then(function() {
									archiveList(ul);
									tabOverflow($(ul).attr('id'));
									dfd.resolve();
								});
							}
						});
					}
				}
				else {
					
					// close a tab that's not current
					removeContentForTab(that);
					if($that.hasClass('hiddenTab')) {
						$that.remove();
						// Only archive here because closing a current tab initiates a show event
						archiveList(ul);
						tabOverflow($(ul).attr('id'));
						dfd.resolve();
					} else {
						$that.addClass('disableHover').animate({'opacity':'0'}, 75).css('height','1px').animate({'width':0}, 400, function() {
							$that.remove();
							// Only archive here because closing a current tab initiates a show event
							archiveList(ul);
							tabOverflow($(ul).attr('id'));
							dfd.resolve();
						});
					}
				}
			} else {
				// computer says no
				dfd.reject();
			}
			return dfd.promise();
		},
		content: function(filter) {
			// Find the content associated with the li or ul
			var contentArray = [];
			if(this.is('ul')) {
				$.each(this.find('li'), function(index, value) {
					if($("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").length > 0) {
						if(typeof filter == 'undefined' || filter == '') {
							contentArray.push($("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").get(0));
						} else {
							$("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").find(filter).each(function() {
								contentArray.push(this);
							});
						}
					}
				});
			} else if(this.is('li')) {
				$.each(this, function(index, value) {				
					if($("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").length > 0) {
						if(typeof filter == 'undefined' || filter == '') {
							contentArray.push($("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").get(0));
						} else {
							$("div[data-ztabid="+$(value).data('ztabid')+"_content], ul[data-ztabid="+$(value).data('ztabid')+"_content]").find(filter).each(function() {
								contentArray.push(this);
							});
						}
					}
				});
			}
			contentArray = $.unique(contentArray);
			return this.pushStack(contentArray);
		},
		current: function() {
			if(this.selector == '') {
				var $tabSet = $(getTabSet());
			} else {
				var $tabSet = $(this);
			}
			
			// Returns false if there isn't a current tab.  This can happen when the tabs load the first tim
			var currentExists = false;
			// there will be multiple tabsets again one day so this supports a jQuery set as the return value
			var currentArray = [];
			$tabSet.each(function() {
				currentArray.push($(getTabSet()).data('currentTab'));
				if(!currentExists && typeof $(getTabSet()).data('currentTab') != 'undefined') {
					currentExists = true;
				}
			});
			if(currentExists) {
				currentArray = $.unique(currentArray);
				return $tabSet.pushStack(currentArray);
			} else {
				return false;
			}

		},
		fromAnchor: function(options) {
			var options = options || {};
			
			// Find the anchors if this set isn't a set of anchors.  buttons count as anchors but not for the find
			var anchors = this.first().is("a, button, input[type='button']") ? this : this.find("a");
			
			return anchors.each(function() {
				// Get the inherent options
				options.label = $(this).html();
				
				// default with fromAnchor is a closeable tab
				if(typeof options.closeable == 'undefined') {
					options.closeable = true;
				}

				if($(this).attr('href')) {
					options.contenturl = $(this).attr('href');
				} else if($(this).data('contenturl')) {
					options.contenturl = $(this).data('contenturl');
				} else {
					// Error
					alert('data-contenturl is not set.');
					return;
				}
				
				// IE translates relative URLs prematurely
				if($.browser.msie) {
					var URLArray = options.contenturl.split('#');
					if(URLArray.length > 1) {
						options.contenturl = '#'+URLArray[URLArray.length - 1];
					}
				}
				
				// hide the associated content div if it's local
				if(options.contenturl.substr(0,1) == '#') {
					$(options.contenturl).addClass('hiddenTabContent');
				}
				
				// add options and anything stored as data- to the default settings
				var tabOptions = {};
				$.extend(tabOptions, settings, options, $(this).data());

				// deal with the click
				$(this).unbind('click');

				if(tabOptions.parentid != 'undefined' && tabOptions.parentid) {
					var $ul = $(cleanId(tabOptions.parentid));
				} else {
					var $ul = $(this).zTabs('parentTab').parent();
				}
				
				$(this).click(function() {					
					$ul.zTabs('add', tabOptions);
					return false;
				});
			});
		},
		isCurrent: function() {
			if(this.data('ztabid') == $($(getTabSet(this.get(0))).data('currentTab')).data('ztabid')) {
				return true;
			} else {
				return false;
			}
		},
		parentContent: function(filter) {
			var filter = filter || '';
			return $(this).zTabs('parentTab').zTabs('content', filter);
		},
		parentTab: function() {
			var tabId = $(this).parents("[data-ztabid]:first").data('ztabid').split("_content")[0];
			return $('[data-ztabid='+tabId+']');
		},
		property: function(key, value) {
			// Get/set the properties of tab(s).  Works like jQuery's attr
			// accepts name, name & value or name and function
			var redraw;
			if(arguments.length == 1) {
				if(typeof key == 'object') {
					// if it's an object, set all the key, value pairs
					return this.each(function() {
						if($(this).is('ul')) {
							$(this).find('li').each(function() {
								for(k in key) {
									processProperty(this, k, key[k]);
								}
							});
						} else if($(this).is('li')) {
							for(k in key) {
								processProperty(this, k, key[k]);
							}
						}
					});
				} else {
					// get the value of the first element
					return $(this).data(key);
				}
			}
			if(arguments.length == 2) {
				return this.each(function() {
					if($(this).is('ul')) {
						$(this).find('li').each(function() {
							processProperty(this, key, value);
						});
					} else if($(this).is('li')) {
						processProperty(this, key, value);
					}
				});
			}
		},
		refresh: function() {
			// returns a deffered object
			var dfd = $.Deferred();
			// at the moment this only supports content, not subtabs		
			this.each(function() {
				var li = this; // for use inside the get
				// if contenturl doesn't start with #, ajax for the content
				if($(this).data('contenturl').substr(0,1) != '#') {
					$.get($(this).data('contenturl')).success(function(data) {
						$("div[data-ztabid="+$(li).data('ztabid')+"_content], ul[data-ztabid="+$(li).data('ztabid')+"_content]").html(data);
						dfd.resolve();
					}).error(function() {
						dfd.reject();
					});
				}
			});
			return dfd.promise();
		},
		show: function() {
			var dfd = $.Deferred();

			if(checkOnSleeps(this)) {
				// only open the tabs that aren't already open (hence the subtraction)
				var diff = arraySubtraction(tabAncestors(this), tabAncestors($(getTabSet(this)).data('currentTab')));
				if(diff.length == 0) {
					// the tab must already be current
					dfd.resolve();			
				} else {
					var that = this;
					$.when(showTab(diff)).then(function() {
						archiveList($(that).parent());
						dfd.resolve();
					});
				}
			}
			return dfd.promise();
		},
		showPath: function(path) {
			var path = path || '';
			var dfd = $.Deferred();

			if(checkOnSleeps(this) || path != '') {
				var tabPath = path.split('/');
				if(tabPath.length < 1) {
					return;
				}
				if(tabPath[0] == '#' || tabPath[0] == '') {
					tabPath.shift(); // remove the #
				}
				$.when(showTab(tabPath)).then(function() {
					// rebuildAll();
					// Archive all?
					dfd.resolve();
				});
			}
			return dfd.promise();
		},
		tabOverflowAll: function() {
			tabOverflowAll();
		}
	};
	
	$.fn.zTabs = function(method) {
		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.zTabs' );
		}    
	};
	
	// HERE TEMPORARILY FOR BACKWARD COMPATIBILITY
	$.fn.zTabsCC = function(filter) {
		 return $(this).zTabs('cc', filter);
	};
	$.fn.zTabsProperty = function(obj) {
		var lcKeys = {};
		for(var key in obj) {
			lcKeys[key.toLowerCase()] = obj[key]; 
		}
		return $(this).zTabs('property', lcKeys);
	};
	$.fn.zTabsCC = function(filter) {
		 return $(this).zTabs('cc', filter);
	};

	//
	// Walk through the list items and set up their initial values
	//
	function parseTheList(obj, rowNumber) {
		// first add the row class
		$(obj).addClass('row'+rowNumber);

		// find the top <ul> for this tabSet
		if(typeof $(obj).attr('data-ztabsset') != 'undefined') {
			var topUl = obj;
		} else {
			var topUl = getTabSet(obj);
		}
	
		// Add the settings here then override any with local content
		$(obj).children('li').each(function() {

			// suck up any info we need for this li
			if(typeof $(this).data('contenturl') == 'undefined') {
				$(this).data('contenturl', $(this).find('a').attr('href'));
			}
						
			$(this).attr('data-ztabid',$(topUl).data('ztabsset')+"_"+$(topUl).data('ztabsid'));
			$(topUl).data('ztabsid', $(topUl).data('ztabsid')+1);  // ++
			
			// IE turns a href like #something into http://www.zurka.com/theCurrentPage.php#something once
			// the href enters the DOM.  This is the wrong place to make that conversion from relative to absolute in IMHO
			// For the tabs, it messes up contenturl.  Local content no longer starts with a #
			if($.browser.msie) {
				var URLArray = $(this).data('contenturl').split('#');
				if(URLArray.length > 1) {
					$(this).data('contenturl', '#'+URLArray[URLArray.length - 1]);
				}
			}	
				
			// Go through the settings array and set any data that's not been set locally
			for(var i=0; i<tabSettings.length; i++) {
				if(typeof $(this).data(tabSettings[i]) == 'undefined') {
					$(this).data(tabSettings[i], settings[tabSettings[i]]);
				}
			}

			// what is the label for this tab
			if($(this).data('label') == false) {
				$(this).data('label', $(this).find('a').html());
			} else {
				$(this).find('a').html($(this).data('label'));
			}
			
			// Set up the label.  Truncate if appropriate			
			if($(this).data('maxlabelsize')) {
				if($(this).data('label').length > $(this).data('maxlabelsize')) {
					var title = $(this).data('label');
					$(this).data('label', $(this).data('label').substring(0,$(this).data('maxlabelsize') - 3) + "...");
					$(this).find('a').attr({title:title}).html($(this).data('label'));	
				}
			}
			
			if($(this).attr("id") == '') {
				$(this).attr({id:uniqueId($(this).data('label'))});
			}

			// hide the associated content div if it's local
			// add the ztabid
			if($(this).data('contenturl').substr(0,1) == '#') {
				$($(this).data('contenturl')).addClass('hiddenTabContent').attr({'data-ztabid':$(this).attr('data-ztabid')+'_content'});

				// If it points to a ul, then parse that list and set up the subtabs
				if($($(this).data('contenturl')).is('ul')) {
					var rowNum = Number(whichRow($(this).parent())+1);
					parseTheList($($(this).data('contenturl')), rowNum);
					
					$($(this).data('contenturl')).children('li').each(function() {
						// set the click, doubleClick and close button
						setUpTab(this);
					});
				}
			}
		});
		
		// Check to see if the tabs are overflowing in this ul
		tabOverflow($(obj).attr('id'));
	}

	// Bind the appropriate actions to clicking on the tabs
	function setUpTab(li) {
		// when the link for the tab is clicked: this is where much of the work happens
		// STEVE do we need to unbind things first?  Are you sure?
		$(li).find('a').unbind('click').click(function(event) {
			event.preventDefault();	
			if(clickLock) {
				return false;
			}
			
			if(checkOnSleeps(li)) {
				$(li).zTabs('show');
			}			
			return false;
		});
		
		// add a refreshbutton if it's set as refreshable
		addRefreshButton(li);
		// add a closebutton if it's set as closeable
		addCloseButton(li);
	}
	
	function addRefreshButton(li) {		
		var $li = $(li);
		if($li.data('refreshable') && !$li.find('.refreshTabButton').is('a')) {
			$li.find('a:last').addClass('closeTabText');
			$li.prepend('<a class="refreshTabButton" onclick="$(this).parent().zTabs(\'refresh\');return false;" href="#">'+settings.refreshbutton+'</a>');
		} else if(!$li.data('refreshable') && !$li.data('closeable')) {
			$li.find('a:last').removeClass('closeTabText');
		}
	}

	function addCloseButton(li) {
		var $li = $(li);
		if($li.data('closeable') && !$li.find('.closeTabButton').is('a')) {
			$li.find('a:last').addClass('closeTabText');
			$li.prepend('<a class="closeTabButton" onclick="$(this).parent().zTabs(\'close\');return false;" href="#">'+settings.closebutton+'</a>');
		} else if(!$li.data('refreshable') && !$li.data('closeable')) {
			$li.find('a:last').removeClass('closeTabText');
		}
	}
	
	//
	// Support zTabsProperty by assigning properties to the li(s)
	//
	function processProperty(li, key, value) {
		var key = key.toLowerCase();
		$(li).data(key, value);
		
		// some changes will require a rewritten tab
		if(key=='contenturl') {
			$(li).find('a').attr('href', value);
		}
		if(key=='label') {
			$(li).find('a[class!="closeTabButton"]').html(value);
			addCloseButton(li);
		}
		if(key=='closeable') {
			addCloseButton(li);
		}
	}
	
	// 
	// This is where the work gets done to show a tab and any subtabs below it.
	// The recursion and all the branching can make it intimidating, but don't be discouraged.
	//
	function showTab(tabArray) {		
		// Accepts a single id or an array of them.  It returns a promise.
		if(typeof tabArray == 'undefined') {
			return;
		} else if(typeof tabArray == 'string') {
			var tabArray = [tabArray];
		} else {
			var tabArray = tabArray;
		}
	
		// Set the recentTabId
		if($(this).zTabs('current')) {
			recentTabId = $(this).zTabs('current').data('ztabid');
		}

		// set clickLock
		clickLock = true;
		var nextTabId = cleanId(tabArray.shift());		
		var $nextTabId = $(nextTabId);
		
		// Singleton Support
		if(typeof $nextTabId.data('singleton') != 'undefined') {
			var singId = $nextTabId.data('singleton');
			var ztId = $nextTabId.data('ztabid');
			$('[data-singleton='+singId+']').each(function() {
				// does it have content loaded
				var tryContent = $(this).data('ztabid')+'_content';
				if($('[data-ztabid='+tryContent+']').length == 1) {
					$('[data-ztabid='+tryContent+']').attr('data-ztabid', ztId+'_content');
					return false;
				}
			});
		}
		
		// returns a promise		
		var dfd = $.Deferred();
		// when this is all done, run the rowchange callback
		dfd.then(function() {
			rowChange();
		});
	
		if($nextTabId.length < 1) {
			// the tab doesn't exist
			// perhaps a path got passed in that isn't currently valid, we might need to get the tab from local storage, etc.
			if($(getTabSet()).zTabs('current') == false) {
				// there isn't a current tab
				var ul = getTabSet();
			} else {
				// var ulId = $(getTabSet()).zTabs('current').data('ztabid');
				var ul = $('.currentSubTabs:last').get(0);  // $('[data-ztabid='+ulId+'_content]').get(0);
			}
			$.when(rebuildList(ul)).then(function() {
				if($(ul).find('li.current, li.currentWithSecondRow').length != 1) {
					// give up.  show the first tab
					var thisId = $(ul).find('li:first').attr('id');
					$.when($(ul).find('li:first').zTabs('show')).then(function() {
						dfd.resolve();
					});
				} else {
					dfd.resolve();
				}
			});
			return dfd.promise();
		}	
		// if already has the content and it's already being show update the classes.  Otherwise, there's a bunch of work to do
		if ($('[data-ztabid='+$nextTabId.data('ztabid')+'_content]').length == 1 && ($nextTabId.hasClass('current') || $nextTabId.hasClass('currentWithSecondRow')) ) {
			// the tab was already set, make sure it's content is showing
			$(getTabSet(nextTabId)).data('currentTab', $nextTabId.get(0));
			if($("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").is('ul')) {
				$("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").removeClass('hiddenTabContent').addClass('currentSubTabs');
			} else {
				// must be a div
				$("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").removeClass('hiddenTabContent').addClass('currentTabContent');	
			}
			
			// If there's another tab in the array, deal with it
			if(tabArray.length > 0) {
				$.when(showTab(tabArray)).then(function() {
					dfd.resolve();
				});
			} else if ($nextTabId.hasClass('currentWithSecondRow') && $("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").find('li.current').length < 1) {
				// The current tab has child tabs but none of them are current.  This is probably because the current one was just closed
				$.when(showTab($("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").find('li:first').attr('id'))).then(function() {
					dfd.resolve();
				});
			} else if ($nextTabId.hasClass('currentWithSecondRow') && $("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").find('li.current').length == 1) {
					$.when(showTab($("[data-ztabid="+$nextTabId.data('ztabid')+"_content]").find('li.current').attr('id'))).then(function() {
						dfd.resolve();
					});
				
			} else {
				clickLock = false;
				updateURL(nextTabId);
				onCreate(nextTabId);
				onWake(nextTabId);
				dfd.resolve();
			}
		} else {
			// hide current tab's, sub tabs
			$nextTabId.parent().find('.currentWithSecondRow').each(function () {
				hideSubTabs(this);
			});

			var tabSetNumber = $nextTabId.data('ztabid').substr(0,1);
			$('.currentTabContent[data-ztabid^="'+tabSetNumber+'"]').removeClass('currentTabContent').addClass('hiddenTabContent');

			// change previous tab, that's a sibling, remove the closebutton if it has one
			$nextTabId.parent().find('.current').removeClass('current');
			$nextTabId.parent().find('.currentWithSecondRow').removeClass('currentWithSecondRow');

			// show current tab, sub tabs and current content
			// Add some clarity to the code by setting up this variable
			var contenturl = $nextTabId.data('contenturl');
			// Local Content
			if(contenturl.substr(0,1) == '#') {
				// Is it a list for subtabs
				if($(contenturl).is('ul')) {
					// set class for ul
					$(contenturl).removeClass('hiddenTabContent').addClass('currentSubTabs');
					$(contenturl).addClass('zTabs');
					$nextTabId.addClass('currentWithSecondRow');
					syncOverflow($nextTabId.parent().find('.overflowTab'));

					$(getTabSet(nextTabId)).data('currentTab', $nextTabId.get(0));
					// parse the list the first time it needs to be rendered
					if(typeof $(contenturl).children('li').data('ztabid') == 'undefined') {
						var rowNum = Number(whichRow($nextTabId.parent())+1);
						parseTheList($(contenturl), rowNum);
						$(contenturl).children('li').each(function() {
							// set the click, doubleClick and close button
							setUpTab(this);
						});
					}

					onCreate(nextTabId);
					onWake(nextTabId);
					
					// find the next tab, the one already set to current, or set the first one in the list
					var $newUL = $(contenturl);
					if(tabArray.length > 0) {
						$.when(showTab(tabArray)).then(function() {
							dfd.resolve();
						});
					} else if($newUL.find('li.current, li.currentWithSecondRow').length == 1) {
						$.when(showTab($newUL.find('li.current, li.currentWithSecondRow').attr('id'))).then(function() {
							dfd.resolve();
						});
					} else {
						$.when(rebuildList($newUL.get(0))).then(function() {
							if($newUL.find('li.current, li.currentWithSecondRow').length >= 1) {
								dfd.resolve();
							} else {
								// give up.  show the first tab
								$.when(showTab($newUL.find('li:first').attr('id'))).then(function() {
									dfd.resolve();
								});
							}
						});
						// return dfd.promise();
					}
				} else {					
					// label the content div
					if(typeof $(contenturl).attr('data-ztabid') == 'undefined') {
						$(contenturl).attr('data-ztabid', $nextTabId.data('ztabid')+'_content');
					}

					loadingTabComplete(nextTabId);
					$nextTabId.addClass('current');
					$(getTabSet(nextTabId)).data('currentTab', $nextTabId.get(0));
					syncOverflow($nextTabId.parent().find('.overflowTab'));

					// set the class.  
					$(contenturl).removeClass('hiddenTabContent').addClass('currentTabContent');

					clickLock = false;
					updateURL(nextTabId);
					onCreate(nextTabId);
					onWake(nextTabId);
					dfd.resolve();
				}
			}
			else {
				// Remote content
				if($nextTabId.data('cache') && $("div[data-ztabid="+$nextTabId.data('ztabid')+"_content], ul[data-ztabid="+$nextTabId.data('ztabid')+"_content]").length) {
					// It is cached
					// For any case, we need to replace loading with the label
					loadingTabComplete(nextTabId);
					
					clickLock = false;

					if($("ul[data-ztabid="+$nextTabId.data('ztabid')+"_content]").length > 0) {
						// It's a list										
						$nextTabId.addClass('currentWithSecondRow');
						syncOverflow($nextTabId.parent().find('.overflowTab'));
						if($.browser.msie && $.browser.version.substr(0,1) < 8) {
							// IE 6/7 can't handle this well
						} else {
							$("ul[data-ztabid="+$nextTabId.data('ztabid')+"_content]").css({display:'none'});
						}
						$("ul[data-ztabid="+$nextTabId.data('ztabid')+"_content]").removeClass('hiddenTabContent').addClass('currentSubTabs');
						onWake(nextTabId);
				
						// find the next tab, the one already set to current, or set the first one in the list
						var $newUL = $("ul[data-ztabid="+$nextTabId.data('ztabid')+"_content]");
						// Slide open the tab once everything is finished
						dfd.then(function() {
							if($.browser.msie && $.browser.version.substr(0,1) < 8) {
								// IE 6/7 can't handle this well
							} else {
								$newUL.slideDown('fast', function() {
									$(this).css('display', '');
								});
							}
						});
						
						if(tabArray.length > 0) {
							$.when(showTab(tabArray)).then(function() {
								dfd.resolve();
							});
						} else if($newUL.find('li.current, li.currentWithSecondRow').length == 1) {
							$.when(showTab($newUL.find('li.current, li.currentWithSecondRow').attr('id'))).then(function() {
								dfd.resolve();
							});
						} else {
							// rebuild and try again
							$.when(rebuildList($newUL.get(0))).then(function() {
								if($newUL.find('li.current, li.currentWithSecondRow').length == 1) {
									dfd.resolve();
								} else {
									// give up.  show the first tab
									$.when(showTab($newUL.find('li:first').attr('id'))).then(function() {
										dfd.resolve();
									});
								}
							});
						}
					} else {
						// just content				
						$nextTabId.addClass('current');
						syncOverflow($nextTabId.parent().find('.overflowTab'));
						
						$(getTabSet(nextTabId)).data('currentTab', $nextTabId.get(0));					
						$("div[data-ztabid="+$nextTabId.data('ztabid')+"_content]").removeClass('hiddenTabContent').addClass('currentTabContent');
						clickLock = false;
						updateURL(nextTabId);
						onWake(nextTabId);
						dfd.resolve();
					}
				} 
				else {
					// Go get that remote data
					loadingTab(nextTabId);
					$.when(fetchData(contenturl)).then(function(data) {						
						var regEx = /^\s*(<ul[\s\S]*?<\/ul>)([\s\S]*)/;  // look for this pattern: <optional white-space> <ul> <content>
						var matchArray = data.match(regEx);
						if(matchArray) {
							// IT'S A LIST
							var dataUl = matchArray[1];
							var dataContent = matchArray[2];
							var scriptTag = '';

							// Remove the scripts from the content so they can be added
							// after everything else is set up. This doesn't handle multiple <script> tags
							var regEx4Script =  /^([\s\S]*)(<script[\s\S]*?<\/script>)([\s\S]*)/;
							var contentArray = dataContent.match(regEx4Script);
							if(contentArray) {
								scriptTag = contentArray[2];
								dataContent = contentArray[1]+contentArray[3];
							}

							var contentdivid = $(getTabSet(nextTabId)).data('contentdivid');
							var subrowsdivid = $(getTabSet(nextTabId)).data('subrowsdivid');

							$nextTabId.addClass('currentWithSecondRow');
							syncOverflow($nextTabId.parent().find('.overflowTab'));
							
							// STEVE, you were playing with sliding down here
							if($.browser.msie && $.browser.version.substr(0,1) < 8) {
								// IE 6/7 can't handle this well
							} else {
								dataUl = dataUl.replace(/\<ul/i, "<ul style='display:none'");
							}
							// dataUl = document.createTextNode(dataUl);
							// $(dataUl).find(ul).css({display:'none'}).attr({foo:'bar'});							

							if(subrowsdivid != '') {
								// if subrowsdivid exists we need find it in subrowsdivid
								$('#'+subrowsdivid).append(dataUl);
								var $newUL = $('#'+subrowsdivid).find('ul:last');
							} else {
								// otherwise it will just be after the one we're working on 
								$nextTabId.parent().after(dataUl);
								var $newUL = $nextTabId.parent().next();
							}
							
							$newUL.addClass('currentSubTabs').attr('data-ztabid', $nextTabId.data('ztabid')+'_content');
							$newUL.attr('id',nextTabId.substr(1)+"_zSubTabs");
							// set class for ul
							$newUL.removeClass('hiddenTabContent').addClass('zTabs');

							// $newUL.slideDown('slow');

							// currentTab = li;
							$(getTabSet(nextTabId)).data('currentTab', $nextTabId.get(0));

							// Put the content in the DOM.  This needs to happen before parseTheList is called
							// so that a list with local content has a chance to hide that content.  It's not ideal.
							if(contentdivid != '') {
								$('#'+contentdivid).append(dataContent);
							} else {
								$nextTabId.parent().after(dataContent);
							}

							var rowNum = Number(whichRow($nextTabId.parent())+1);
							parseTheList($newUL, rowNum);

							$newUL.children('li').each(function() {
								// set the click, doubleClick and close button
								setUpTab(this);
							});					

							loadingTabComplete(nextTabId);
							clickLock = false;

							// if(contentdivid != '') {
							// 	$('#'+contentdivid).append(dataContent);
							// } else {
							// 	$nextTabId.parent().after(dataContent);
							// }

							// Slide open the tab once everything is finished
							dfd.then(function() {
								if($.browser.msie && $.browser.version.substr(0,1) < 8) {
									// ie6/7 are too slow for the sliding
									$newUL.css({display:''});
									// if(contentdivid != '') {
									// 	$('#'+contentdivid).append(dataContent);
									// } else {
									// 	$nextTabId.parent().after(dataContent);
									// }
								} else {
									$newUL.slideDown('fast', function() {
										// if(contentdivid != '') {
										// 	$('#'+contentdivid).append(dataContent);
										// } else {
										// 	$nextTabId.parent().after(dataContent);
										// }
										$(this).css('display', '');
									});
								}
							});
					
							// add the script tags back, script tag for a list?  I guess but where does it go, there is no content
							if(scriptTag != '') {
								$nextTabId.zTabs('cc').append(scriptTag);
							}						
							onCreate(nextTabId);
							onWake(nextTabId);

							// find the next tab, the on already set to current, or set the first one in the list
							if(tabArray.length > 0) {
								$.when(showTab(tabArray)).then(function() {
									dfd.resolve();
								});
							} else if($newUL.find('li.current, li.currentWithSecondRow').length == 1) {
								$.when(showTab($newUL.find('li.current, li.currentWithSecondRow').attr('id'))).then(function() {
									dfd.resolve();
								});
							} else {

								// rebuild and try again
								$.when(rebuildList($newUL.get(0))).then(function() {
									if($newUL.find('li.current, li.currentWithSecondRow').length == 1) {
										dfd.resolve();
									} else {
										// give up.  show the first tab
										$.when(showTab($newUL.find('li:first').attr('id'))).then(function() {
											dfd.resolve();
										});
									}


								});
								// return dfd.promise();
							}					
						}
						else {
							// NOT A LIST, MUST BE CONTENT FOR A SINGLE TAB
							$(getTabSet()).data('currentTab', $nextTabId.get(0)); // STEVE is there a better place for this step?
							
							// if the div exists, replace its content, otherwise create a new div 
							if($("div[data-ztabid="+$nextTabId.data('ztabid')+"_content]").length) {				
								loadingTabComplete(nextTabId);
								$nextTabId.addClass('current');
								$("div[data-ztabid="+$nextTabId.data('ztabid')+"_content]").html(data).removeClass('hiddenTabContent').addClass('currentTabContent');
							} else {
								// create the div and place content in it
								var newDiv = document.createElement('div');
								newDiv.className = 'currentTabContent';
								$(newDiv).attr('data-ztabid', $nextTabId.data('ztabid')+'_content');
								var contentdivid = $(getTabSet(nextTabId)).data('contentdivid');
								if(contentdivid != '') {
									// put the new div inside the designated content div
									$('#'+contentdivid).append(newDiv);
								} else {
									$nextTabId.parent().parent().append(newDiv);
								}
								$nextTabId.addClass('current');								
								$("div[data-ztabid="+$nextTabId.data('ztabid')+"_content]").html(data);

								loadingTabComplete(nextTabId);				
							}
							syncOverflow($nextTabId.parent().find('.overflowTab'));
							clickLock = false;
							updateURL(nextTabId);
							onCreate(nextTabId);
							onWake(nextTabId);
							dfd.resolve();
						}
					});
				}
			}
		}
		return dfd.promise();
	}	
	
	function fetchData(contenturl) {
		// Is it trying to use JSONP?  
		if(contenturl.indexOf('?') != -1 && contenturl.indexOf('?') != contenturl.lastIndexOf('?')) {
			// there is more than one ? in this URL
			// One day this should have a formal way of catching errors
			var dfd = $.Deferred();
			$.when($.getJSON(contenturl)).then(function(data) {
				dfd.resolve(data.html);
			});
			return dfd.promise();
		} else {
			// go get it via ajax
			return $.get(contenturl);
		}	
	}
	
	function getTabSet(li) {
		// This accepts a DOM reference to a list item or the ID of the list item
		// Currently the argument doesn't matter.  At one time zTabs supported multiple instances of itself on a page
		// That support was taken out when History was added in.  One day I'll add it back, if people need it.
		return $('[data-ztabsset=0]').get(0);
	}
	
	function tabAncestorsToPath(li) {
		var zIdArray = tabAncestors(li);
		var path = '/'+zIdArray.join('/');
		return path;
	}
	
	function tabAncestors(li, zIdArray) {
		// builds array from lowest level to top level
		var zIdArray = zIdArray || new Array();
		zIdArray.unshift($(li).attr('id'));
		
		if(typeof $(li).parent().data('ztabid') !== 'undefined') {
			var liId = $(li).parent().data('ztabid').split("_");
			$("li[data-ztabid="+liId[0]+"_"+liId[1]+"]").each(function () {
				return tabAncestors(this, zIdArray);
			});
		}
		return zIdArray;
	}
	
	
	function tabDecendants(li, zIdArray) {
		// builds array from current level to the lowest level
		var zIdArray = zIdArray || new Array();
		zIdArray.push($(li).data('ztabid'));
		$("ul[data-ztabid="+$(li).data('ztabid')+"_content]").find('.current, .currentWithSecondRow').each(function() {
			return tabDecendants(this, zIdArray);
		});
		return zIdArray;
	}

	// Utility
	function arraySubtraction(array1, array2) {
		var returnArray = new Array();
		for(var i=0; i<array1.length; i++) {
			if(jQuery.inArray(array1[i], array2) == -1) {
				returnArray.push(array1[i]);
			}
		}
		return returnArray;
	}

	function checkOnSleeps(newTab) {		
		// find the ancestors that the current tab doesn't have in common with the new tab
		// these are the ones that need to close
		var closeTabs = arraySubtraction(tabAncestors($(getTabSet(newTab)).data('currentTab')), tabAncestors(newTab));

		var sleepResult = true;
		for(var i=0; i<closeTabs.length; i++) {
			if(typeof $("#"+closeTabs[i]).data('onsleep') == 'function') {
				sleepResult = $("#"+closeTabs[i]).data('onsleep')();
			}
			if(!sleepResult) {
				break;
			}
		}
		// remove the contents for tabs that are going to sleep and cache=false
		if(sleepResult) {
			for(var i=0; i<closeTabs.length; i++) {
				if($("#"+closeTabs[i]).data('cache') == false) {
					removeContentForTab($("#"+closeTabs[i]).get(0));
				}
			}
		}
		
		return sleepResult;
	}
	
	function hideSubTabs(li) {
		$("ul[data-ztabid="+$(li).data('ztabid')+"_content]").find('.currentWithSecondRow').each(function () {
			hideSubTabs(this);
		});
		$("ul[data-ztabid="+$(li).data('ztabid')+"_content]").removeClass('currentSubTabs').addClass('hiddenTabContent');
	}
	
	function loadingTab(nextTabId) {
		$(nextTabId).find('a:last').parent().addClass('pending');
		//$(nextTabId).find('a:last').css({color:'#948e7e'});
	}
	
	function loadingTabComplete(nextTabId) {
		$(nextTabId).find('a:last').parent().removeClass('pending');
		//$(nextTabId).find('a:last').css({color:''});
	}
	
	function execCreateAndWake() {
		return true;
	}
	
	function removeContentForTab(li) {
		var li = li;
		
		// if it's a singleton, reassign the zTabId if possible
		var contentConvert = '';
		if(typeof $(li).data('singleton') != 'undefined') {
			$('[data-singleton='+$(li).data('singleton')+']').each(function() {
				if($(this).data('ztabid') != $(li).data('ztabid')) {
					// we found another singleton by the same name
					contentConvert = $(this).data('ztabid')+'_content';
					return false;
				}
			});
		}

		var contentId = $(li).data('ztabid')+"_content";
		if(contentConvert != '') {
			// it's a singleton.  convert it
			$('[data-ztabid="'+contentId+'"]').attr('data-ztabid', contentConvert).addClass('hiddenTabContent').removeClass('currentTabContent');
		} else {
			if($('ul[data-ztabid="'+contentId+'"]').length > 0) {
				$('ul[data-ztabid="'+contentId+'"]').find('li').each(function() {
					removeContentForTab(this);
				});
			}
			// $('div[data-ztabid="'+contentId+'"], ul[data-ztabid="'+contentId+'"]').remove();
			var rm1 = $('div[data-ztabid='+contentId+']').get(0);
			if(rm1) {
				rm1.parentNode.removeChild(rm1);
			}
			var rm2 = $('ul[data-ztabid='+contentId+']').get(0);
			if(rm2) {
				rm2.parentNode.removeChild(rm2);
			}
		}
	}
	
	function checkOnCloses(closeTab) {
		// This tab and every subtab has a chance to thwart the closing 
		var closeTabs = tabDecendants(closeTab);
		var closeResult = true;
		for(var i=0; i<closeTabs.length; i++) {
			$("li[data-ztabid="+closeTabs[i]+"]").each(function() {
				if(typeof $(this).data('onclose') == 'function') {
					closeResult = $(this).data('onclose')(this);
				}
			});
			if(closeResult === false) {
				break;
			} else {
				// be tolerant of those who don't return a value
				closeResult = true;
			}
		}
		return closeResult;		
	}
	
	function onCreate(tabId) {
		if(typeof $(tabId).data('oncreate') == 'function') {		
			$(tabId).data('oncreate')($(tabId).zTabs('content'));
			$(tabId).data('oncreate', null);
		}
	}
	
	function onWake(tabId) {
		if(typeof $(tabId).data('onwake') == 'function') {
			$(tabId).data('onwake')($(tabId).zTabs('content'));
		}
	}
	
	function updateURL(li) {
		currentLocationHash = tabAncestorsToPath(li);
		if(!clickLock) {
			if($('#zTabHistory').length > 0) {
				// we must be using the iFrame for IE history
				if($('#zTabHistory').attr('src').search(/blank.html/) > -1) {
					var file = 'blank2.html';
				} else {
					var file = 'blank.html';
				}
				iFrameLock = true;
				$('#zTabHistory').attr({src:file+"#"+currentLocationHash});				
			}
			location.hash = currentLocationHash;
		}
	}
	
	// Save a list to local storage
	// ul can be a DOM element or an id
	function archiveList(ul) {
		if(typeof localStorage == 'undefined' || settings.localstorage == 'ignore' || settings.localstorage == false) {
			return;
		}
		
		var ul = ul || false;
		if(!ul) {
			return;
		} else if(typeof ul == 'string') {
			ul = $('#'+ul).get(0);
		}
		
		// build an array of items/tabs in this list
		listItems = [];
		$(ul).find('li:not(.overflowTab)').each(function() {			
			var item = {id: $(this).attr('id'), 'theclass': $(this).attr('class'), data:$(this).data()};		
			listItems.push(item);
		});
		// store the array	
		localStorage.setItem($(ul).attr('id'), JSON.stringify(listItems));
	}

	// Reconstitute a list based on what's in local storage
	// ul can be a DOM element of an id
	function rebuildList(ul) {
		var ul = ul || false;
		var dfd = $.Deferred();		
		
		if(!ul || typeof localStorage == 'undefined' || settings.localstorage == 'ignore' || settings.localstorage == false) {
			dfd.resolve();
			return dfd.promise();
		} else if(typeof ul == 'string') {
			ul = $('#'+ul).get(0);
		}

		var tabsToAdd = [];
		if(localStorage.getItem($(ul).attr('id')) != null) {		
			var tabIds = JSON.parse(localStorage.getItem($(ul).attr('id')));
			for(i in tabIds) {	
				
				// if(!$('#'+tabIds[i].id).is('li')) {
				if(!$(cleanId(tabIds[i].id)).is('li')) {
					// the tab doesn't exist.  It should be added back in
					if(tabIds[i].theclass == 'current' || tabIds[i].theclass == 'currentWithSecondRow' || tabIds[i].theclass == 'hiddenTab current' || tabIds[i].theclass == 'hiddenTab currentWithSecondRow') {
						tabIds[i].data.show = true;
					} else {
						tabIds[i].data.show = false;
					}
					tabIds[i].data.tabid = tabIds[i].id;
					tabIds[i].data.position = i;
					tabsToAdd.push({ul:ul, data: tabIds[i].data});
				} else {
					// the tab does exist, should it be current?
					
					if(tabIds[i].theclass == 'current' || tabIds[i].theclass == 'currentWithSecondRow' || tabIds[i].theclass == 'hiddenTab current' || tabIds[i].theclass == 'hiddenTab currentWithSecondRow') {
						var showLater = cleanId(tabIds[i].id);
					}
				}
			}
		}
		
		// We only want to resolve when all the tabs are setup
		$.when(addTabArray(tabsToAdd)).then(function() {
			if(typeof showLater != 'undefined') {
				$.when($(showLater).zTabs('show')).then(function() {
					tabOverflow($(ul).attr('id'));
					dfd.resolve();
				});
			} else {
				tabOverflow($(ul).attr('id'));
				dfd.resolve();
			}
		});
		return dfd.promise();
	}
	
	// Adds tabs recursively for rebuildList
	function addTabArray(tabsToAdd) {
		var tabsToAdd = tabsToAdd || [];
		var dfd = $.Deferred();
		
		if(tabsToAdd.length < 1) {
			dfd.resolve();
		} else {
			var tab = tabsToAdd.shift();
			
			$.when($(tab.ul).zTabs('add', tab.data), addTabArray(tabsToAdd)).then(function() {
				dfd.resolve();
			});
		}
		return dfd.promise();
	}
	
	function rebuildAll() {
		// find all the ztab uls and rebuild them
		$('ul.zTabs').each(function() {
			rebuildList(this);
		});
	}
	
	function tabOverflowAll() {
		// find all the ztab uls and rebuild them
		$('ul.zTabs').each(function() {
			tabOverflow($(this).attr('id'));
		});
	}

	// Check to see if the tabs in a given ul are overflowing
	function tabOverflow(ulId) {
		// find all the tabs that are going to be in the overflow, if any
		var overflowTabs = [];
		var i = 0;
		var currTab = '';		
		
		var ulWidth = $('#'+ulId).width();
		var liWidth = 0;
		var heights = [];  // IE7 will expand the height to avoid an overflow
		$('#'+ulId).find('li:not(.overflowTab)').each(function() {
			liWidth = liWidth + $(this).width();
			heights.push($(this).height());
		});
		
		var ieHeightProblem = false;
		if(heights.length > 0) {
			// compare heights
			var totalHeight = 0;
			for(var i=0; i<heights.length; i++) {
				totalHeight = totalHeight + heights[i];
			}
			var avgHeight = totalHeight/heights.length;
			
			for(var i=0; i<heights.length; i++) {
				if(heights[i] > avgHeight) {
					ieHeightProblem = true;
				}
			}
		} else {
			return;
		}
				
		if(liWidth > ulWidth || ieHeightProblem) {
			var total = 172; // the overflow tab width
			$('#'+ulId).find('li:not(.overflowTab)').each(function() {
				total = total + $(this).width();
				if(total > ulWidth || $(this).height() > 1.1 * avgHeight) {
					overflowTabs.push($(this).attr('id'));
					$(this).addClass('hiddenTab');
				} else {
					$(this).removeClass('hiddenTab');
				}
				if($(this).hasClass('current') || $(this).hasClass('currenWithSecondRow') || $(this).hasClass('hiddenTab currentWithSecondRow') || $(this).hasClass('hiddenTab current')) {
					// there should always be a current one, right?
					currTab = $(this).attr('id');
				}
				i++;
			});
		} else {
			// The overflow tab isn't needed so display any hidden tabs
			$('#'+ulId).find('li:not(.overflowTab)').each(function() {
				$(this).removeClass('hiddenTab');
			});
		}		
		


		var html = '';
		html += '<span><select>';
		for(var i=0; i<overflowTabs.length; i++) {
			var tabId = '#'+overflowTabs[i];
			if(tabId.substr(1) == currTab) {
				var selected = ' selected';
			} else {
				var selected = '';
			}
			html += '<option'+selected+' value="'+tabId.substr(1)+'">'+$(tabId).data('label')+'</option>';
		}
		
		// If there are overflow tabs finish up the html and put it out there
		if(overflowTabs.length) {
			// set up the overflow tab
			html += '</select></span>';
			var overflowTab = document.createElement('li');
			$(overflowTab).attr({id:ulId+'_overflowTab', 'class':'overflowTab'}).html(html);
			if($('#'+ulId).find('.overflowTab').length) {
				$('#'+ulId).find('.overflowTab').remove();
			}
			$('#'+ulId).append(overflowTab);
		} else {
			$('#'+ulId).find('.overflowTab').remove();
		}
		syncOverflow($('#'+ulId+'_overflowTab'));
	}
	
	// Sync up the overflow tab with the info from the tab is currently is representing
	// Send it the overflow tab
	function syncOverflow($overflowTab) {
		var tabId = '#'+$overflowTab.find('select').val();
		
		if($(tabId).hasClass('current')) {
			$overflowTab.addClass('overflowCurrent');
		} else {
			$overflowTab.removeClass('overflowCurrent');
		}
		if($(tabId).hasClass('currentWithSecondRow')) {
			$overflowTab.addClass('overflowCurrentWithSecondRow');
		} else {
			$overflowTab.removeClass('overflowCurrentWithSecondRow');
		}
		
		$overflowTab.find('a').remove();
		if($(tabId).data('refreshable')) {
			$overflowTab.find('span').addClass('closeTabText');
			$overflowTab.prepend('<a href="#" onclick="$(\''+tabId+'\').zTabs(\'refresh\');return false;" class="refreshTabButton"><img border="0" width="11" height="11" src="'+$(getTabSet()).zTabs('property','imagebaseurl')+'refresh_button.png"></a> ');
		}
		
		if($(tabId).data('closeable')) {
			$overflowTab.find('span').addClass('closeTabText');
			$overflowTab.prepend('<a href="#" onclick="$(\''+tabId+'\').zTabs(\'close\');return false;" class="closeTabButton"><img border="0" width="11" height="11" src="'+$(getTabSet()).zTabs('property','imagebaseurl')+'close_tab_button_white.gif"></a> ');
		}
		
		if(!$(tabId).data('refreshable') && !($(tabId).data('closeable'))) {
			$overflowTab.find('span').removeClass('closeTabText');
		}
		
	}
	
	// TEMP.  It belongs in a better place
	$('.overflowTab select').live('change', function() {
		var tabId = '#'+$(this).val();
		var that = this;
		$.when($(tabId).zTabs('show')).then(function() {
			syncOverflow($(that).parent().parent());
		});
	});
		
	$('.overflowTab:not(.overflowTab img)').live('click', function(event) {
		if(event.target.nodeName == 'IMG' || event.target.nodeName == 'SELECT') {
			// These are not the driods you're looking for
			return;
		}

		$('#'+$(this).find('select').val()).zTabs('show');
	});
	
	$('.overflowTab select').live('click', function(event) {
		event.stopPropagation();
	});
	
	function rowChange() {
		if(typeof settings.rowchange == 'function') {
			settings.rowchange();
		}
	}
	
	function initialized() {
		if(typeof settings.initialized == 'function') {
			settings.initialized();
		}
	}

	// Send this the label of your tab and it will return an id for it.
	// The id is guaranteed to be unique in the current DOM and, in most cases
	// it will be consistent every time.  (conflicts in the DOM undermine consistency)
	function uniqueId(label) {
		var label = label || false;
		if(typeof label != 'string') {
			var now = new Date();
			label = now.getTime();
		}		
		var newId = 'z_'+label.replace(/[^0-9a-z]/gi,'_');
		if($('#'+newId).length > 0) {
			newId = uniqueId(newId);
		}
		return newId;
	}
	
	// ID's need to have certain charaters escaped :.|[] for jQuery selectors to work
	function cleanId(suspectId) {
		var suspectId = suspectId || false;
		if(!suspectId) {
			return;
		}
		return '#' + suspectId.replace(/(:|\.|\[|\])/g,'\\$1');
	 }
	
	// STEVE isn't there a better way to do this.  Recursion to the rescue?
	function whichRow(ul) {
		// return the row number that this ul has
		for(var i=0; i<256; i++) {
			if($(ul).hasClass('row'+i)) {
				return Number(i);
			}
		}
	}

})( jQuery );
