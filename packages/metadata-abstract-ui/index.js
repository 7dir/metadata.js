"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

function ui(constructor, classes) {

	Object.defineProperty(constructor.prototype, 'UI', {

		value: {

			/**
    * ### Возвращает имя типа элемента управления для типа поля
    * TODO: перенести этот метод в плагин
    *
    * @method control_by_type
    * @param type
    * @return {*}
    */
			control_by_type(type, val) {
				let ft;

				if (typeof val == "boolean" && type.types.indexOf("boolean") != -1) {
					ft = "ch";
				} else if (typeof val == "number" && type.digits) {
					if (type.fraction_figits < 5) ft = "calck";else ft = "edn";
				} else if (val instanceof Date && type.date_part) {
					ft = "dhxCalendar";
				} else if (type.is_ref) {
					ft = "ocombo";
				} else if (type.date_part) {
					ft = "dhxCalendar";
				} else if (type.digits) {
					if (type.fraction_figits < 5) ft = "calck";else ft = "edn";
				} else if (type.types[0] == "boolean") {
					ft = "ch";
				} else if (type.hasOwnProperty("str_len") && (type.str_len >= 100 || type.str_len == 0)) {
					ft = "txt";
				} else {
					ft = "ed";
				}
				return ft;
			}
		}

	});
} /**
  * ### Метаданные системных перечислений, регистров и справочников
  *
  * @module meta_objs
  *
  * Created 08.01.2017
  */

function meta_objs() {

	const { classes } = this;

	/**
  * ### Менеджер объектов метаданных
  * Используется для формирования списков типов документов, справочников и т.д.
  * Например, при работе в интерфейсе с составными типами
  */
	class MetaObjManager extends classes.CatManager {}

	/**
  * ### Менеджер доступных полей
  * Используется при настройке отчетов и динамических списков
  */
	class MetaFieldManager extends classes.CatManager {}

	/**
  * ### Журнал событий
  * Хранит и накапливает события сеанса
  * Является наследником регистра сведений
  * @extends InfoRegManager
  * @class LogManager
  * @static
  */
	class LogManager extends classes.InfoRegManager {

		constructor() {
			super("ireg.log");
		}

		/**
   * Добавляет запись в журнал
   * @param msg {String|Object|Error} - текст + класс события
   * @param [msg.obj] {Object} - дополнительный json объект
   */
		record(msg) {

			if (msg instanceof Error) {
				if (console) console.log(msg);
				msg = {
					class: "error",
					note: msg.toString()
				};
			} else if (typeof msg == "object" && !msg.class && !msg.obj) {
				msg = {
					class: "obj",
					obj: msg,
					note: msg.note
				};
			} else if (typeof msg != "object") msg = { note: msg };

			msg.date = Date.now() + wsql.time_diff;

			// уникальность ключа
			if (!this.smax) this.smax = alasql.compile("select MAX(`sequence`) as `sequence` from `ireg_log` where `date` = ?");
			var res = this.smax([msg.date]);
			if (!res.length || res[0].sequence === undefined) msg.sequence = 0;else msg.sequence = parseInt(res[0].sequence) + 1;

			// класс сообщения
			if (!msg.class) msg.class = "note";

			wsql.alasql("insert into `ireg_log` (`ref`, `date`, `sequence`, `class`, `note`, `obj`) values (?,?,?,?,?,?)", [msg.date + "¶" + msg.sequence, msg.date, msg.sequence, msg.class, msg.note, msg.obj ? JSON.stringify(msg.obj) : ""]);
		}

		/**
   * Сбрасывает события на сервер
   * @method backup
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		backup(dfrom, dtill) {}

		/**
   * Восстанавливает события из архива на сервере
   * @method restore
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		restore(dfrom, dtill) {}

		/**
   * Стирает события в указанном диапазоне дат
   * @method clear
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		clear(dfrom, dtill) {}

		show(pwnd) {}

		get(ref, force_promise, do_not_create) {

			if (typeof ref == "object") ref = ref.ref || "";

			if (!this.by_ref[ref]) {

				if (force_promise === false) return undefined;

				var parts = ref.split("¶");
				wsql.alasql("select * from `ireg_log` where date=" + parts[0] + " and sequence=" + parts[1]).forEach(row => new RegisterRow(row, this));
			}

			return force_promise ? Promise.resolve(this.by_ref[ref]) : this.by_ref[ref];
		}

		get_sql_struct(attr) {

			if (attr && attr.action == "get_selection") {
				var sql = "select * from `ireg_log`";
				if (attr.date_from) {
					if (attr.date_till) sql += " where `date` >= ? and `date` <= ?";else sql += " where `date` >= ?";
				} else if (attr.date_till) sql += " where `date` <= ?";

				return sql;
			} else return classes.InfoRegManager.prototype.get_sql_struct.call(this, attr);
		}

		caption_flds(attr) {

			var _meta = attr && attr.metadata || this.metadata(),
			    acols = [];

			if (_meta.form && _meta.form[attr.form || 'selection']) {
				acols = _meta.form[attr.form || 'selection'].cols;
			} else {
				acols.push(new Col_struct("date", "200", "ro", "left", "server", "Дата"));
				acols.push(new Col_struct("class", "100", "ro", "left", "server", "Класс"));
				acols.push(new Col_struct("note", "*", "ro", "left", "server", "Событие"));
			}

			return acols;
		}

		data_to_grid(data, attr) {
			var xml = "<?xml version='1.0' encoding='UTF-8'?><rows total_count='%1' pos='%2' set_parent='%3'>".replace("%1", data.length).replace("%2", attr.start).replace("%3", attr.set_parent || ""),
			    caption = this.caption_flds(attr);

			// при первом обращении к методу добавляем описание колонок
			xml += caption.head;

			data.forEach(row => {
				xml += "<row id=\"" + row.ref + "\"><cell>" + moment(row.date - wsql.time_diff).format("DD.MM.YYYY HH:mm:ss") + "." + row.sequence + "</cell>" + "<cell>" + (row.class || "") + "</cell><cell>" + (row.note || "") + "</cell></row>";
			});

			return xml + "</rows>";
		}

	}

	/**
  * ### Виртуальный справочник MetaObjs
  * undefined
  * @class CatMeta_objs
  * @extends CatObj
  * @constructor
  */
	this.CatMeta_objs = class CatMeta_objs extends classes.CatObj {};

	/**
  * ### Виртуальный справочник MetaFields
  * undefined
  * @class CatMeta_fields
  * @extends CatObj
  * @constructor
  */
	this.CatMeta_fields = class CatMeta_fields extends classes.CatObj {};

	// публикуем конструкторы системных менеджеров
	Object.defineProperties(classes, {
		MetaObjManager: { value: MetaObjManager },
		MetaFieldManager: { value: MetaFieldManager }
	});

	// создаём системные менеджеры метаданных
	Object.defineProperties(this.cat, {
		meta_objs: {
			value: new MetaObjManager('cat.meta_objs')
		},
		meta_fields: {
			value: new MetaFieldManager('cat.meta_fields')
		}
	});
} /**
  *
  * ### Метаданные журнала регистрации
  *
  * @module log_manager
  *
  * Created 08.01.2017
  */

function log_manager() {

	const { classes } = this;

	/**
  * ### Журнал событий
  * Хранит и накапливает события сеанса
  * Является наследником регистра сведений
  * @extends InfoRegManager
  * @class LogManager
  * @static
  */
	class LogManager extends classes.InfoRegManager {

		constructor() {
			super("ireg.log");
		}

		/**
   * Добавляет запись в журнал
   * @param msg {String|Object|Error} - текст + класс события
   * @param [msg.obj] {Object} - дополнительный json объект
   */
		record(msg) {

			if (msg instanceof Error) {
				if (console) console.log(msg);
				msg = {
					class: "error",
					note: msg.toString()
				};
			} else if (typeof msg == "object" && !msg.class && !msg.obj) {
				msg = {
					class: "obj",
					obj: msg,
					note: msg.note
				};
			} else if (typeof msg != "object") msg = { note: msg };

			msg.date = Date.now() + wsql.time_diff;

			// уникальность ключа
			if (!this.smax) {
				this.smax = alasql.compile("select MAX(`sequence`) as `sequence` from `ireg_log` where `date` = ?");
			}
			var res = this.smax([msg.date]);
			if (!res.length || res[0].sequence === undefined) msg.sequence = 0;else msg.sequence = parseInt(res[0].sequence) + 1;

			// класс сообщения
			if (!msg.class) msg.class = "note";

			wsql.alasql("insert into `ireg_log` (`ref`, `date`, `sequence`, `class`, `note`, `obj`) values (?,?,?,?,?,?)", [msg.date + "¶" + msg.sequence, msg.date, msg.sequence, msg.class, msg.note, msg.obj ? JSON.stringify(msg.obj) : ""]);
		}

		/**
   * Сбрасывает события на сервер
   * @method backup
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		backup(dfrom, dtill) {}

		/**
   * Восстанавливает события из архива на сервере
   * @method restore
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		restore(dfrom, dtill) {}

		/**
   * Стирает события в указанном диапазоне дат
   * @method clear
   * @param [dfrom] {Date}
   * @param [dtill] {Date}
   */
		clear(dfrom, dtill) {}

		show(pwnd) {}

		get(ref, force_promise, do_not_create) {

			if (typeof ref == "object") ref = ref.ref || "";

			if (!this.by_ref[ref]) {

				if (force_promise === false) return undefined;

				var parts = ref.split("¶");
				wsql.alasql("select * from `ireg_log` where date=" + parts[0] + " and sequence=" + parts[1]).forEach(row => new RegisterRow(row, this));
			}

			return force_promise ? Promise.resolve(this.by_ref[ref]) : this.by_ref[ref];
		}

		get_sql_struct(attr) {

			if (attr && attr.action == "get_selection") {
				var sql = "select * from `ireg_log`";
				if (attr.date_from) {
					if (attr.date_till) sql += " where `date` >= ? and `date` <= ?";else sql += " where `date` >= ?";
				} else if (attr.date_till) sql += " where `date` <= ?";

				return sql;
			} else return classes.InfoRegManager.prototype.get_sql_struct.call(this, attr);
		}

		caption_flds(attr) {

			var _meta = attr && attr.metadata || this.metadata(),
			    acols = [];

			if (_meta.form && _meta.form[attr.form || 'selection']) {
				acols = _meta.form[attr.form || 'selection'].cols;
			} else {
				acols.push(new Col_struct("date", "200", "ro", "left", "server", "Дата"));
				acols.push(new Col_struct("class", "100", "ro", "left", "server", "Класс"));
				acols.push(new Col_struct("note", "*", "ro", "left", "server", "Событие"));
			}

			return acols;
		}

		data_to_grid(data, attr) {
			var xml = "<?xml version='1.0' encoding='UTF-8'?><rows total_count='%1' pos='%2' set_parent='%3'>".replace("%1", data.length).replace("%2", attr.start).replace("%3", attr.set_parent || ""),
			    caption = this.caption_flds(attr);

			// при первом обращении к методу добавляем описание колонок
			xml += caption.head;

			data.forEach(row => {
				xml += "<row id=\"" + row.ref + "\"><cell>" + moment(row.date - wsql.time_diff).format("DD.MM.YYYY HH:mm:ss") + "." + row.sequence + "</cell>" + "<cell>" + (row.class || "") + "</cell><cell>" + (row.note || "") + "</cell></row>";
			});

			return xml + "</rows>";
		}

	}

	/**
  * ### Регистр сведений log
  * Журнал событий
  * @class IregLog
  * @extends RegisterRow
  * @constructor
  */
	this.IregLog = class IregLog extends classes.RegisterRow {

		get date() {
			return this._getter('date');
		}
		set date(v) {
			this._setter('date', v);
		}

		get sequence() {
			return this._getter('sequence');
		}
		set sequence(v) {
			this._setter('sequence', v);
		}

		get class() {
			return this._getter('class');
		}
		set class(v) {
			this._setter('class', v);
		}

		get note() {
			return this._getter('note');
		}
		set note(v) {
			this._setter('note', v);
		}

		get obj() {
			return this._getter('obj');
		}
		set obj(v) {
			this._setter('obj', v);
		}

	};

	// публикуем конструкторы системных менеджеров
	Object.defineProperties(classes, {
		LogManager: { value: LogManager }
	});

	// создаём менеджер журнала регистрации
	Object.defineProperty(this.ireg, 'log', {
		value: new LogManager('ireg.log')
	});
}
/**
 * ### Менеджер настроек отчетов и динсписков
 *
 * @module scheme_settings
 *
 * Created 19.12.2016
 */

function scheme_settings() {

	const { wsql, utils, cat, dp, md, classes } = this;

	/**
  * ### Менеджер настроек отчетов и динсписков
  */
	class SchemeSettingsManager extends classes.CatManager {

		/**
   * ### Возвращает объект текущих настроек
   * - если не существует ни одной настройки для _class_name_, создаёт элемент справочника _SchemeSettings_
   * - если в localstorage есть настройка для текущего пользователя, возвращает её
   *
   * @param class_name
   */
		get_scheme(class_name) {
			return new Promise(function (resolve, reject) {

				// получаем сохраненную настройку
				const scheme_name = "scheme_settings_" + class_name.replace(/\./g, "_");
				let ref = wsql.get_user_param(scheme_name, "string");

				function set_param_and_resolve(obj) {
					wsql.set_user_param(scheme_name, obj.ref);
					resolve(obj);
				}

				function find_scheme() {
					cat.scheme_settings.find_rows_remote({
						_view: 'doc/scheme_settings',
						_top: 100,
						_skip: 0,
						_key: {
							startkey: class_name,
							endkey: class_name
						}
					}).then(function (data) {
						// если существует с текущим пользователем, берём его, иначе - первый попавшийся
						if (data.length == 1) {
							set_param_and_resolve(data[0]);
						} else if (data.length) {} else {
							create_scheme();
						}
					}).catch(function (err) {
						create_scheme();
					});
				}

				function create_scheme() {
					if (!utils.is_guid(ref)) {
						ref = utils.generate_guid();
					}
					cat.scheme_settings.create({ ref }).then(function (obj) {
						return obj.fill_default(class_name).save();
					}).then(function (obj) {
						set_param_and_resolve(obj);
					});
				}

				if (ref) {
					// получаем по гвиду
					cat.scheme_settings.get(ref, "promise").then(function (scheme) {
						if (scheme && !scheme.is_new()) {
							resolve(scheme);
						} else {
							find_scheme();
						}
					}).catch(function (err) {
						find_scheme();
					});
				} else {
					find_scheme();
				}
			});
		}

	}

	/**
  * ### Обработка выбора варианта настроек scheme_settings
  * @class CatScheme_settings
  * @extends DataProcessorObj
  * @constructor
  */
	this.DpScheme_settings = class DpScheme_settings extends classes.DataProcessorObj {
		get scheme() {
			return this._getter('scheme');
		}
		set scheme(v) {
			this._setter('scheme', v);
		}
	};

	/**
  * ### Справочник scheme_settings
  * Настройки отчетов и списков
  * @class CatScheme_settings
  * @extends CatObj
  * @constructor
  */
	this.CatScheme_settings = class CatScheme_settings extends classes.CatObj {

		get obj() {
			return this._getter('obj');
		}
		set obj(v) {
			this._setter('obj', v);
		}

		get user() {
			return this._getter('user');
		}
		set user(v) {
			this._setter('user', v);
		}

		get query() {
			return this._getter('query');
		}
		set query(v) {
			this._setter('query', v);
		}

		get fields() {
			return this._getter_ts('fields');
		}
		set fields(v) {
			this._setter_ts('fields', v);
		}

		get sorting() {
			return this._getter_ts('sorting');
		}
		set sorting(v) {
			this._setter_ts('sorting', v);
		}

		get dimensions() {
			return this._getter_ts('dimensions');
		}
		set dimensions(v) {
			this._setter_ts('dimensions', v);
		}

		get resources() {
			return this._getter_ts('resources');
		}
		set resources(v) {
			this._setter_ts('resources', v);
		}

		get selection() {
			return this._getter_ts('selection');
		}
		set selection(v) {
			this._setter_ts('selection', v);
		}

		get params() {
			return this._getter_ts('params');
		}
		set params(v) {
			this._setter_ts('params', v);
		}

		get scheme() {
			return this._getter_ts('scheme');
		}
		set scheme(v) {
			this._setter_ts('scheme', v);
		}

		/**
   * ### Заполняет настройки по метаданным
   *
   * @param class_name
   */
		fill_default(class_name) {

			const parts = class_name.split("."),
			      _mgr = md.mgr_by_class_name(class_name),
			      _meta = parts.length < 3 ? _mgr.metadata() : _mgr.metadata(parts[2]),
			      fields = this.fields,
			      columns = [];

			function add_column(fld, use) {
				const id = fld.id || fld,
				      fld_meta = _meta.fields[id] || _mgr.metadata(id);
				columns.push({
					field: id,
					caption: fld.caption || fld_meta.synonym,
					tooltip: fld_meta.tooltip,
					width: fld.width || fld_meta.width,
					use: use
				});
			}

			// набираем поля
			if (parts.length < 3) {
				// поля динсписка

				if (_meta.form && _meta.form.selection) {

					_meta.form.selection.cols.forEach(fld => {
						add_column(fld, true);
					});
				} else {

					if (_mgr instanceof classes.CatManager) {
						if (_meta.code_length) {
							columns.push('id');
						}

						if (_meta.main_presentation_name) {
							columns.push('name');
						}
					} else if (_mgr instanceof classes.DocManager) {
						columns.push('number_doc');
						columns.push('date');
					}

					columns.forEach(id => {
						// id, synonym, tooltip, type, width
						add_column(id, true);
					});
				}
			} else {
				// поля табличной части

				for (var field in _meta.fields) {
					add_column(field, true);
				}
			}

			for (var field in _meta.fields) {
				if (!columns.some(function (column) {
					return column.field == field;
				})) {
					add_column(field, false);
				}
			}

			// заполняем табчасть доступных полей
			columns.forEach(function (column) {
				fields.add(column);
			});

			this.obj = class_name;

			if (!this.name) {
				this.name = "Основная";
			}

			return this;
		}

		/**
   * ### Устанавливает _view и _key в параметрах запроса
   */
		fix_select(select, key0) {

			const keys = this.query.split("/");
			const { _key, _view } = select;
			let res;

			if (keys.length > 2) {
				key0 = keys[2];
			}

			if (_key.startkey[0] != key0) {
				_key.startkey[0] = _key.endkey[0] = key0;
				res = true;
			}

			if (keys.length > 1) {
				const select_view = keys[0] + "/" + keys[1];
				if (_view != select_view) {
					select._view = select_view;
					res = true;
				}
			}

			// если есть параметр период, установим значения ключа

			return res;
		}

		/**
   * ### Возвращает массив колонок для динсписка или табчасти
   * @param mode {String} - режим формирования колонок
   * @return {Array}
   */
		columns(mode) {

			const parts = this.obj.split("."),
			      _mgr = md.mgr_by_class_name(this.obj),
			      _meta = parts.length < 3 ? _mgr.metadata() : _mgr.metadata(parts[2]),
			      res = [];

			this.fields.find_rows({ use: true }, function (row) {

				const fld_meta = _meta.fields[row.field] || _mgr.metadata(row.field);
				let column;

				if (mode == "ts") {
					column = {
						key: row.field,
						name: row.caption,
						resizable: true,
						width: row.width == '*' ? 250 : parseInt(row.width) || 140,
						ctrl_type: row.ctrl_type
					};
				} else {
					column = {
						id: row.field,
						synonym: row.caption,
						tooltip: row.tooltip,
						type: fld_meta.type,
						ctrl_type: row.ctrl_type,
						width: row.width == '*' ? 250 : parseInt(row.width) || 140
					};
				}
				res.push(column);
			});
			return res;
		}

		/**
   * ### Возвращает массив имён используемых колонок
   * @return {Array}
   */
		used_fields() {
			const res = [];
			this.fields.find_rows({ use: true }, row => {
				res.push(row.field);
			});
			return res;
		}

		/**
   * ### Возвращает массив элементов для поля выбора
   * @return {Array}
   */
		used_fields_list() {
			return this.fields._obj.map(row => ({
				id: row.field,
				value: row.field,
				text: row.caption,
				title: row.caption
			}));
		}
	};

	this.CatScheme_settingsDimensionsRow = class CatScheme_settingsDimensionsRow extends classes.TabularSectionRow {

		get parent() {
			return this._getter('parent');
		}
		set parent(v) {
			this._setter('parent', v);
		}

		get field() {
			return this._getter('field');
		}
		set field(v) {
			this._setter('field', v);
		}
	};

	this.CatScheme_settingsResourcesRow = class CatScheme_settingsResourcesRow extends this.CatScheme_settingsDimensionsRow {

		get formula() {
			return this._getter('formula');
		}
		set formula(v) {
			this._setter('formula', v);
		}
	};

	this.CatScheme_settingsFieldsRow = class CatScheme_settingsFieldsRow extends this.CatScheme_settingsDimensionsRow {

		get use() {
			return this._getter('use');
		}
		set use(v) {
			this._setter('use', v);
		}

		get width() {
			return this._getter('width');
		}
		set width(v) {
			this._setter('width', v);
		}

		get caption() {
			return this._getter('caption');
		}
		set caption(v) {
			this._setter('caption', v);
		}

		get tooltip() {
			return this._getter('tooltip');
		}
		set tooltip(v) {
			this._setter('tooltip', v);
		}

		get ctrl_type() {
			return this._getter('ctrl_type');
		}
		set ctrl_type(v) {
			this._setter('ctrl_type', v);
		}

		get formatter() {
			return this._getter('formatter');
		}
		set formatter(v) {
			this._setter('formatter', v);
		}

		get editor() {
			return this._getter('editor');
		}
		set editor(v) {
			this._setter('editor', v);
		}

	};

	this.CatScheme_settingsSortingRow = class CatScheme_settingsSortingRow extends this.CatScheme_settingsDimensionsRow {

		get direction() {
			return this._getter('direction');
		}
		set direction(v) {
			this._setter('direction', v);
		}
	};

	this.CatScheme_settingsSelectionRow = class CatScheme_settingsSelectionRow extends classes.TabularSectionRow {

		get parent() {
			return this._getter('parent');
		}
		set parent(v) {
			this._setter('parent', v);
		}

		get use() {
			return this._getter('use');
		}
		set use(v) {
			this._setter('use', v);
		}

		get left_value() {
			return this._getter('left_value');
		}
		set left_value(v) {
			this._setter('left_value', v);
		}

		get comparison_type() {
			return this._getter('comparison_type');
		}
		set comparison_type(v) {
			this._setter('comparison_type', v);
		}

		get right_value() {
			return this._getter('right_value');
		}
		set right_value(v) {
			this._setter('right_value', v);
		}
	};

	this.CatScheme_settingsParamsRow = class CatScheme_settingsParamsRow extends classes.TabularSectionRow {

		get param() {
			return this._getter('param');
		}
		set param(v) {
			this._setter('param', v);
		}

		get value() {
			return this._getter('value');
		}
		set value(v) {
			this._setter('value', v);
		}
	};

	this.CatScheme_settingsSchemeRow = class CatScheme_settingsSchemeRow extends classes.TabularSectionRow {

		get parent() {
			return this._getter('parent');
		}
		set parent(v) {
			this._setter('parent', v);
		}

		get kind() {
			return this._getter('kind');
		}
		set kind(v) {
			this._setter('kind', v);
		}

	};

	Object.defineProperties(cat, {
		scheme_settings: {
			value: new SchemeSettingsManager('cat.scheme_settings')
		}
	});

	Object.defineProperties(dp, {
		scheme_settings: {
			value: new classes.DataProcessorsManager('dp.scheme_settings')
		}
	});
} /**
  * Плагин-модификатор abstract-ui для metadata.js
  *
  * @module plugin
  *
  * Created 05.10.2016
  */

/**
 * Экспортируем объект-плагин для модификации metadata.js
 */
exports.default = {

	/**
  * ### Модификатор прототипов
  * @param constructor {MetaEngine}
  * @param classes {Object}
  */
	proto(constructor, classes) {
		ui(constructor, classes);
	},

	/**
  * ### Модификатор конструктора MetaEngine
  * Вызывается в контексте экземпляра MetaEngine
  */
	constructor() {

		meta_objs.call(this);
		log_manager.call(this);
		scheme_settings.call(this);
	}
};
