/*
 * Calendar.js
 * Работа с плагином FullCalendar - http://fullcalendar.io/
 */

window.Calendar = function(){
    function calendar(options) {
        var $this = this;
        this.defaultOptions = {
            selector: '#calendar',
            unselectCancel:'.popover', //при активации элемента с таким классом выделение с выделнного дня сниматься не будет
            header: {
                left: 'prev, title, next today', //Настройка "тулбара" календаря
                center: '',
                right: ''
            },
            columnFormat: {
                month: 'dddd',
            },
            //отображение события в календаре
            eventRender: function(event, cell, element) {
                var eventTemplate = _.template($('#event-render-template').html())({
                    event:event
                })
                cell.html(eventTemplate);
                //подсветка дня в котором содержится событие
                $this.highlightDayWithEvent(event);
            },
            //клик на дне календаря
            dayClick: function(date,  jsEvent, view) {
                $this.onDayClick(date, jsEvent.target, view);
            },
            //клик на событии календаря
            eventClick: function(calEvent, jsEvent, view) {
                $this.onEventClick(calEvent, jsEvent.target, view);
            },
        }

        this.calendarOptions = $.extend(true, this.defaultOptions, options);
        this.init();
    }

    calendar.prototype.init = function() {
        this.setupCalendar();
        this.loadEvents();
        this.bindDOMEvents();
    };

    //Инициализия плагина fullcalendar
    calendar.prototype.setupCalendar = function() {
        if (!$.fullCalendar)
            return console.warn("No fullCalendar");
        this.$calendar = $(this.calendarOptions.selector);
        this.$calendar.fullCalendar(this.calendarOptions);
    };

    //Загрузка событий из хранилища LocalStorage
    calendar.prototype.loadEvents = function() {
        this.setEvents(LocalStorage.get('Events'));
    };

    calendar.prototype.setEvents = function(data) {
        this.$calendar.fullCalendar('addEventSource', data);
    };

    //Подключение обработичков событий на странице
    calendar.prototype.bindDOMEvents = function() {
        var $this = this;

        //кнопка "Добавить"
        $('body').on('click', '#add-event', function(e) {
            $this.onAddEventClick(this);
            return false;
        });
        //кнопка "Обновить"
        $('body').on('click', '#edit-event', function(e) {
            $this.onEditEventClick(this);
            return false;
        });
        //Сохранение формы быстрого добавления события
        $('body').on('submit', '#quick-add-event-form', function(e) {
            $this.onSubmitQuickEventForm(this);
            return false;
        });
        //Сохранение формы добавления события
        $('body').on('submit', '.edit-event-form', function(e) {
            $this.onSubmitEventForm(this);
            return false;
        });
        //кнопка "Удалить" в форме редактирования события
        $('body').on('click', '.delete-event', function(e) {
            $this.onDeleteEventClick(this);
            return false;
        });
        //Клик на элементе в окне результатов поиска
        $('body').on('click', 'li.search-item', function (e) {
            $this.onSelectSearchEvent(this);
        });
        //Строка поиска
        $('body').on('keyup', '#search-event', function(e) {
            var request = $(this).val();
            var target = this;

            if (!request){//строка поиска пуста
                $(this).siblings(".clear-input").removeClass('show'); //скрытие кнопки очистки строки поиска
                closePopover(target); //закрытие окна результатов поиска(если открыто)
                return false;
            }

            $(this).siblings(".clear-input").addClass('show');//отображение кнопки очистки строки поиска

            //Отправка запроса на поиск не чаще чем раз в 100мс
            //Уменьшается нагрузка на браузер и сервер(если будет использоваться)
            if ($(this).data('timer')) {
               clearTimeout($(this).data('timer'));
            }
            var timer = setTimeout(function() {
                $this.onSearchEvent(request, target);
            }, 100);

            $(this).data('timer', timer);
        });
        //Клик на кнопке очистки строки поиска
        $('body').on('click', '.clear-input', function(e) {
            $(this).siblings('input[type="text"]').val('');
            $(this).removeClass('show');
        });
        //Закрытие всплавыющего онка при клике на странице
        $('body').on('click', function (e) {
            if ($(e.target).data("bs.popover") == undefined && $(e.target).parents('.popover.in').length === 0) {
                $('body').find('.popover').popover('destroy');
            }

            //корректное снятие выделения с текущего дня при клике вне календаря
            if (!$(e.target).hasClass('fc-today')) {
                $this.uhighlightCurrentDay();
            }
        });
    };

    //кнопка "Добавить"
    calendar.prototype.onAddEventClick = function(target) {
        this.openQuickAddEventForm(target);
    };

    //Клик на дне календаря
    calendar.prototype.onDayClick = function(date, target, view) {

        //проверка что день текущий
        //если да - корректно выделить
        //если нет, то снять выделение
        this.highlightCurrentDay(date);

        this.$calendar.fullCalendar('select', date);
        this.openAddEventForm(date, target);
    };

    //Клик на событии календаря
    calendar.prototype.onEventClick = function(event, target) {
        this.openEditEventForm(event, target);
    };

    //показ формы быстрого добавления события
    calendar.prototype.openQuickAddEventForm = function(target) {
        var content = _.template($('#quick-add-event-form-template').html())();
        this._openPopover(target,'', content, {placement:'bottom'});
    };

    //показ формы добавления события к выбранному дню
    calendar.prototype.openAddEventForm = function(date, target, options) {
        var content = _.template($('#add-event-form-template').html())({
            date: moment(date).format(),
            humanDate: moment(date).format('D MMMM')
        });
        this._openPopover(target,'', content, options);
    };

    //форма редактирования события
    calendar.prototype.openEditEventForm = function(event, target) {
        var content = _.template($('#edit-event-form-template').html())({
            members: event.members ?  event.members : '',
            id: event.id,
            humanDate: moment(event.start).format('D MMMM'),
            title: event.title,
            description: event.description ?  event.description : '',
            time: event.time ? event.time : '',
        });
        this._openPopover(target,'', content);
    };

    //сохранение формы быстрого добавления события
    calendar.prototype.onSubmitQuickEventForm = function(target) {
        var eventText = $(target).find('.quick-event-input').val();
        if (!eventText) return false;

        var eventParts = eventText.split(','); //введенная строка вида "10 июля, 16:30, День рождения"
        var eventDate = eventParts[0] ? eventParts[0].trim() : ''; //дата
        var eventTime = eventParts[1] ? eventParts[1].trim() : ''; //время
        var eventTitle = eventParts[2] ? eventParts[2].trim() : '';//событие

        var eventData = {
            start: moment(eventDate + eventTime, 'DD MMM HH:mm")', 'ru').format(),
            title: eventTitle,
            time: eventTime,
        }
        //сохранение
        this.addEvent(eventData);
        //закрытие окна формы
        closePopover(target);
    };

    //сохранение формы добавления события
    //используется при добавлении и обновлени события
    calendar.prototype.onSubmitEventForm = function(target) {
        var eventTitle = $(target).find('input[name="name"]').val();
        var eventId = $(target).find('input[name="id"]').val();
        var eventDate = $(target).find('input[name="event-date"]').val();
        var eventDescription = $(target).find('textarea[name="description"]').val();
        var membersText = $(target).find('input[name="members"]').val();

        var eventData = {
            id:eventId,
            start: eventDate,
            title: eventTitle,
            members: membersText,
            description:eventDescription
        };

        //Если событие новое(нет ID) до добавлям в хранилище
        //Иначе обновляем
        var isNewEvent = eventId ? false : true;

        if (isNewEvent){
            this.addEvent(eventData);
        } else {
            this.updateEvent(eventData);
        }
        closePopover(target);
    };

    //удаление события
    calendar.prototype.onDeleteEventClick = function(target) {
        var eventId = $(target).data('id');
        this.deleteEvent(eventId);
        closePopover(target);
    };

    //клик на кнопке "Обновить"
    //добавляет событие на текущей день...
    calendar.prototype.onEditEventClick = function(target) {
        var now = new Date();
        this.openAddEventForm(now, target, {placement:'bottom'});
    };

    //поиск событий по введенному тексту
    calendar.prototype.onSearchEvent = function(request, target) {
        request = request.trim();

        if (!request)
            return false;

        var events = this.getEvents(); //события в календаре

        //фильтр по названию, участникам и дате события
        var matcher = new RegExp(request, "i");

        var result = $.grep(events, function (event) {
            var humanStart = moment(event.start).format('D MMMM');
            return matcher.test(event.title) || matcher.test(event.members) || matcher.test(humanStart);
        });

        //закрыть окно с результатами если показывать нечего
        if (!result.length) {
            closePopover(target);
            return false;
        }

        result.map(function(event) {
            event.humanStart = moment(event.start).format('D MMMM');
            return event;
        })

        //есть подходящие события
        //отображение результатов
        this.showSearchResult(result, target);
    };

    //отображение результатов поиска
    calendar.prototype.showSearchResult = function(events, target) {
        var content = _.template($('#search-events-results-template').html())({
            events:events
        });

        //Если окно с результатами уже открыто
        //Заменяем результаты поиска без повторного открытия окна
        if($(target).data("bs.popover") !== undefined) {
            $('.search-events-container').replaceWith(content);
            return false;
        }
        this._openPopover(target, '', content, {placement:'bottom', close:false});
    };

    //клик на событии в результатах поисках
    calendar.prototype.onSelectSearchEvent = function(target) {
        var eventId = $(target).data('id');
        var event = this.findEvent(eventId);
        this.selectEvent(event);
        closePopover(target);
    };

    //перемещение по календарю к дню в котором находится событие
    //выделение дня цветом
    calendar.prototype.selectEvent = function(event) {

        //проверка что день текущий
        //если да - корректно выделить
        //если нет, то снять выделение
        this.highlightCurrentDay(event.start);

        this.$calendar.fullCalendar('gotoDate', event.start.format('Y-MM-DD'));
        this.$calendar.fullCalendar('select', event.start);
    };

    //добавления события
    calendar.prototype.addEvent = function(eventData) {
        //сохранение в хранилище
        var eventData = this.syncEvent(eventData, 'add');
        if (!eventData) {
            return false;
        }
        //добавление в календарь
        //переход ко дню события
        var eventData = {
            id:eventData.id,
            title: eventData.title,
            time: eventData.time ? eventData.time : '',
            members: eventData.members ? eventData.members : '',
            description: eventData.description ? eventData.description : '',
            start:eventData.start,
            end:eventData.end ? eventData.end : void 0,
        }
        var event = this.$calendar.fullCalendar('renderEvent', eventData, true);
        this.selectEvent(event[0]);
    };

    //обновление события
    calendar.prototype.updateEvent = function(eventData) {
        //обновление в хранилище
        var eventData = this.syncEvent(eventData, 'update');
        if (!eventData) {
            return false;
        }
        //поиск события в календаре
        //обновление новыми данными
        var event = this.findEvent(eventData.id);
        event = $.extend(true, event, eventData);
        this.$calendar.fullCalendar('updateEvent', event);
    };

    //удаление события
    calendar.prototype.deleteEvent = function(id) {
        //удаление в хранилище
        var eventData = this.syncEvent({'id': id}, 'delete');
        if (!eventData) {
            return false;
        }
        //удаление в календаре

        var event = this.findEvent(id);
        this.$calendar.fullCalendar('removeEvents', id);

        //если в дне календаря нет событий убрать подсветку
        if (!this.findEventsByEvent(event).length){
            this.unHighlightDayWithEvent(event);
        }
    };

    //работа с событиями в хранилище
    calendar.prototype.syncEvent = function(event, operation) {
        var store = LocalStorage.get('Events') || [];
        switch(operation) {
            case 'add': //добавление
                event.id = uniqueId();
                store.push(event);
                break;
            case 'update'://обновление
                for (var i = 0; i < store.length; i++) {
                    if (store[i].id == event.id) {
                        store[i] = $.extend(true, store[i], event);
                        break;
                    }
                }
                break;
            case 'delete'://удаление
                for (var i = 0; i < store.length; i++) {
                    if (store[i].id == event.id) {
                        store.splice(i, 1);
                        break;
                    }
                }
                break;
        }
        LocalStorage.set('Events', store);
        return event;
    };

    //поиск события по ID
    calendar.prototype.findEvent = function(id) {
        return this.getEvents(id)[0];
    };

    //поиск других событий в дне календаря по событию
    calendar.prototype.findEventsByEvent = function(event) {
        return this.getEvents(function(item){
            return moment(event.start).format() == moment(item.start).format();
        });
    };

    //поиск событий по фильтру или ID
    calendar.prototype.getEvents = function(filter) {
        filter = filter ? filter : void 0;
        return this.$calendar.fullCalendar('clientEvents', filter);
    };

    //всплывающее окно
    calendar.prototype._openPopover = function(target, title, content, options) {

        if (options && options.placement){
            options.placement = 'auto ' + options.placement;
        }

        var defaultOptions = {
            container:'body',
            placement: 'auto right',
            html:true,
            content: content,
            title: title,
            close:true
        }

        options = $.extend(true, defaultOptions, options);

        if (options.close) {
            options.title = options.title +'<span class="close">&times;</span>'
        }

        if($(target).data("bs.popover") !== undefined) {
            $(target).data("bs.popover").destroy();
            return false;
        }

        $('body').find('.popover').popover('destroy');

        var popover = $(target).popover(options).on('shown.bs.popover', function(){
            $('body').find('div.popover .close').on('click', function(e){
                popover.popover('destroy');
            });
        });

        $(target).popover('show');
    };

    //корректное выделение или снятие выделения с текущего дня
    calendar.prototype.highlightCurrentDay = function(date) {
        if(date.format('YYYY MMMM DD') === moment().format('YYYY MMMM DD')){
            $('.fc-today').addClass('selected');
        }else {
            this.uhighlightCurrentDay();
        }
    }
    //снятие выделения с текущего дня
    //если выделен
    calendar.prototype.uhighlightCurrentDay = function(date) {
        $('.fc-today.selected').removeClass('selected');
    }

    //подсветка дня в котором есть события
    calendar.prototype.highlightDayWithEvent = function(event) {
        var dateString = moment(event.start).format('YYYY-MM-DD');
        $('body').find('.fc-day[data-date="' + dateString + '"]').addClass('has-events');
    };

    //отключение подсветка дня
    calendar.prototype.unHighlightDayWithEvent = function(event) {
        var dateString = moment(event.start).format('YYYY-MM-DD');
        $('body').find('.fc-day[data-date="' + dateString + '"]').removeClass('has-events');
    };

    //генерация уникального id для нового события (underscore.js)
    function uniqueId() {
        return Math.random().toString(36).substr(2, 10);
    }

    //закрытие вслпыющего окна
    function closePopover(target) {
        if($(target).data("bs.popover")){
            $(target).data("bs.popover").destroy();
        }else $(target).parents('.popover.in').remove();
    }
    return calendar;
}();