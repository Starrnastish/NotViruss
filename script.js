document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const currentTimeElement = document.getElementById('current-time');
    const nextAlarmElement = document.getElementById('next-alarm');
    const addAlarmForm = document.getElementById('add-alarm-form');
    const alarmsContainer = document.getElementById('alarms-container');
    const repeatWeeklyCheckbox = document.getElementById('repeat-weekly');
    const daysContainer = document.getElementById('days-container');
    
    // Показать/скрыть дни недели при изменении чекбокса
    repeatWeeklyCheckbox.addEventListener('change', function() {
        daysContainer.style.display = this.checked ? 'flex' : 'none';
    });
    
    // Загрузка будильников из localStorage
    let alarms = JSON.parse(localStorage.getItem('alarms')) || [];
    
    // Обновление текущего времени каждую секунду
    function updateCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        currentTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
        
        // Проверка срабатывания будильников
        checkAlarms(now);
        
        // Обновление времени до следующего будильника
        updateNextAlarmInfo(now);
    }
    
    setInterval(updateCurrentTime, 1000);
    updateCurrentTime();
    
    // Проверка срабатывания будильников
    function checkAlarms(now) {
        const currentDay = now.getDay(); // 0 (воскресенье) - 6 (суббота)
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentDate = now.toDateString();
        
        alarms.forEach(alarm => {
            if (!alarm.active) return;
            
            const [alarmHours, alarmMinutes] = alarm.time.split(':').map(Number);
            
            // Проверяем совпадение времени (с точностью до минуты)
            if (currentHours === alarmHours && currentMinutes === alarmMinutes && now.getSeconds() === 0) {
                // Для разовых будильников проверяем дату
                if (!alarm.repeatWeekly) {
                    const alarmDate = new Date(alarm.date).toDateString();
                    if (currentDate !== alarmDate) return;
                }
                // Для повторяющихся проверяем день недели
                else if (!alarm.days.includes(currentDay.toString())) {
                    return;
                }
                
                // Проверяем, не срабатывал ли уже этот будильник в эту минуту
                if (!alarm.lastTriggered || new Date(alarm.lastTriggered).getTime() < now.setSeconds(0, 0)) {
                    triggerAlarm(alarm);
                    alarm.lastTriggered = now.toISOString();
                    
                    // Удаляем разовый будильник после срабатывания
                    if (!alarm.repeatWeekly) {
                        alarms = alarms.filter(a => a.id !== alarm.id);
                    }
                    
                    saveAlarms();
                    renderAlarms();
                }
            }
        });
    }
    
    // Срабатывание будильника
    function triggerAlarm(alarm) {
        const audio = document.getElementById(alarm.sound);
        audio.currentTime = 0;
        audio.play();
        
        // Показываем уведомление
        const notification = document.createElement('div');
        notification.className = 'alarm-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>${alarm.name}</h3>
                <p>${alarm.time}</p>
                <button class="btn-snooze">Отложить на 5 минут</button>
                <button class="btn-stop">Остановить</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Отложить будильник
        notification.querySelector('.btn-snooze').addEventListener('click', function() {
            audio.pause();
            const snoozeTime = new Date();
            snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
            
            // Create a new alarm object for the snooze
            const snoozedAlarm = {
                id: Date.now(),
                name: alarm.name,
                time: snoozeTime.toTimeString().split(' ')[0].substring(0, 5),
                days: alarm.days,
                sound: alarm.sound,
                active: true,
                repeatWeekly: alarm.repeatWeekly,
                date: alarm.date,
                lastTriggered: null
            };
            
            alarms.push(snoozedAlarm); // Add the snoozed alarm to the alarms
            saveAlarms();
            renderAlarms(); // Обновляем список будильников
            document.body.removeChild(notification);
        });
        
        // Остановка будильника
        notification.querySelector('.btn-stop').addEventListener('click', function() {
            audio.pause();
            document.body.removeChild(notification);
        });
        
        // Автоматическое закрытие через 1 минуту
        setTimeout(() => {
            if (document.body.contains(notification)) {
                audio.pause();
                document.body.removeChild(notification);
            }
        }, 60000);
    }
    
    // Обновление информации о следующем будильнике
    function updateNextAlarmInfo(now) {
        const activeAlarms = alarms.filter(alarm => alarm.active);
        
        if (activeAlarms.length === 0) {
            nextAlarmElement.textContent = 'Нет активных будильников';
            return;
        }
        
        let closestAlarm = null;
        let minDiff = Infinity;
        
        activeAlarms.forEach(alarm => {
            if (alarm.repeatWeekly) {
                // Для повторяющихся будильников
                alarm.days.forEach(day => {
                    const alarmTime = new Date(now);
                    alarmTime.setHours(...alarm.time.split(':').map(Number), 0, 0);
                    
                    // Устанавливаем день недели
                    let dayDiff = parseInt(day) - now.getDay();
                    if (dayDiff < 0 || (dayDiff === 0 && alarmTime <= now)) {
                        dayDiff += 7;
                    }
                    
                    alarmTime.setDate(now.getDate() + dayDiff);
                    
                    const diff = alarmTime - now;
                    
                    if (diff > 0 && diff < minDiff) {
                        minDiff = diff;
                        closestAlarm = {
                            name: alarm.name,
                            time: alarmTime,
                            days: alarm.days
                        };
                    }
                });
            } else {
                // Для разовых будильников
                const alarmDate = new Date(alarm.date);
                const alarmTime = new Date(alarmDate);
                alarmTime.setHours(...alarm.time.split(':').map(Number), 0, 0);
                
                const diff = alarmTime - now;
                
                if (diff > 0 && diff < minDiff) {
                    minDiff = diff;
                    closestAlarm = {
                        name: alarm.name,
                        time: alarmTime,
                        oneTime: true
                    };
                }
            }
        });
        
        if (closestAlarm) {
            const days = Math.floor(minDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((minDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((minDiff % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeLeft = '';
            if (days > 0) timeLeft += `${days} д. `;
            if (hours > 0 || days > 0) timeLeft += `${hours} ч. `;
            timeLeft += `${Math.round(minutes)} мин.`;
            
            const alarmType = closestAlarm.oneTime ? ' (разовый)' : '';
            nextAlarmElement.textContent = `Следующий: ${closestAlarm.name}${alarmType} через ${timeLeft}`;
        } else {
            nextAlarmElement.textContent = 'Нет активных будильников';
        }
    }
    
    // Добавление нового будильника
    addAlarmForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('alarm-name').value;
        const time = document.getElementById('alarm-time').value;
        const sound = document.getElementById('alarm-sound').value;
        const repeatWeekly = repeatWeeklyCheckbox.checked;
        
        let days = [];
        if (repeatWeekly) {
            days = Array.from(document.querySelectorAll('input[name="day"]:checked'))
                          .map(checkbox => checkbox.value);
        }
        
        const newAlarm = {
            id: Date.now(),
            name,
            time,
            days,
            sound,
            active: true,
            repeatWeekly,
            date: new Date().toISOString(), // Для разовых будильников
            lastTriggered: null
        };
        
        alarms.push(newAlarm);
        saveAlarms();
        renderAlarms();
        
        // Сброс формы
        addAlarmForm.reset();
        daysContainer.style.display = 'none';
        repeatWeeklyCheckbox.checked = false;
    });
    
    // Сохранение будильников в localStorage
    function saveAlarms() {
        localStorage.setItem('alarms', JSON.stringify(alarms));
        updateNextAlarmInfo(new Date());
    }
    
    // Отрисовка списка будильников
   // Отрисовка списка будильников
function renderAlarms() {
    alarmsContainer.innerHTML = '';
    
    if (alarms.length === 0) {
        alarmsContainer.innerHTML = '<p>У вас пока нет будильников</p>';
        return;
    }
    
    // Сортируем будильники по времени
    alarms.sort((a, b) => {
        const timeA = a.time.split(':').map(Number);
        const timeB = b.time.split(':').map(Number);
        
        if (timeA[0] !== timeB[0]) return timeA[0] - timeB[0];
        return timeA[1] - timeB[1];
    });
    
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    alarms.forEach(alarm => {
        const alarmElement = document.createElement('div');
        alarmElement.className = `alarm-item ${alarm.active ? '' : 'disabled'}`;
        
        let daysInfo = '';
        if (alarm.repeatWeekly) {
            daysInfo = alarm.days.map(day => dayNames[parseInt(day)]).join(', ');
        } else {
            const date = new Date(alarm.date);
            daysInfo = `Разовый (${date.toLocaleDateString('ru-RU')})`;
        }

        // Добавляем отметку "Отложенный", если это отложенный будильник
        const snoozedLabel = alarm.isSnoozed ? '<span class="snoozed-label">(Отложенный)</span>' : '';

        alarmElement.innerHTML = `
            <div class="alarm-info">
                <div class="alarm-name">${alarm.name} ${snoozedLabel}</div>
                <div class="alarm-time">${alarm.time}</div>
                <div class="alarm-days">${daysInfo}</div>
                <div class="alarm-sound">${getSoundName(alarm.sound)}</div>
            </div>
            <div class="alarm-actions">
                <button class="btn-toggle">${alarm.active ? 'Выкл' : 'Вкл'}</button>
                <button class="btn-edit">Изменить</button>
                <button class="btn-delete">Удалить</button>
            </div>
        `;
        
        // Обработчики событий для кнопок
        alarmElement.querySelector('.btn-toggle').addEventListener('click', () => {
            alarm.active = !alarm.active;
            saveAlarms();
            renderAlarms();
        });
        
        alarmElement.querySelector('.btn-edit').addEventListener('click', () => {
            editAlarm(alarm);
        });
        
        alarmElement.querySelector('.btn-delete').addEventListener('click', () => {
            if (confirm('Удалить этот будильник?')) {
                alarms = alarms.filter(a => a.id !== alarm.id);
                saveAlarms();
                renderAlarms();
            }
        });
        
        alarmsContainer.appendChild(alarmElement);
    });
    }
    
    // Получение читаемого имени звука
    function getSoundName(soundId) {
        const select = document.getElementById('alarm-sound');
        for (let option of select.options) {
            if (option.value === soundId) {
                return option.text;
            }
        }
        return soundId;
    }
    
    // Редактирование будильника
    function editAlarm(alarm) {
        // Заполняем форму данными будильника
        document.getElementById('alarm-name').value = alarm.name;
        document.getElementById('alarm-time').value = alarm.time;
        document.getElementById('alarm-sound').value = alarm.sound;
        repeatWeeklyCheckbox.checked = alarm.repeatWeekly;
        daysContainer.style.display = alarm.repeatWeekly ? 'flex' : 'none';
        
        // Сбрасываем все чекбоксы дней
        document.querySelectorAll('input[name="day"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Устанавливаем выбранные дни
        alarm.days.forEach(day => {
            const checkbox = document.querySelector(`input[name="day"][value="${day}"]`);
            if (checkbox) checkbox.checked = true;
        });
        
        // Удаляем старый будильник
        alarms = alarms.filter(a => a.id !== alarm.id);
        saveAlarms();
        
        // Прокручиваем к форме
        document.querySelector('.alarm-form').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Инициализация
    renderAlarms();
    
    // Стили для уведомления
    const style = document.createElement('style');
    style.textContent = `
        .alarm-notification {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255, 126, 185, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.3s;
        }
        
        .notification-content {
            background-color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
            max-width: 80%;
        }
        
        .notification-content h3 {
            color: var(--secondary-color);
            margin-bottom: 10px;
            font-size: 1.8rem;
        }
        
        .notification-content p {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 20px;
        }
        
        .btn-stop {
            background-color: var(--hover-color);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.2rem;
            font-weight: 600;
            transition: background-color 0.3s;
        }

        .btn-snooze {
            background-color: var(--hover-color);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.2rem;
            font-weight: 600;
            margin-right: 10px;
            transition: background-color 0.3s;
        }

        .btn-snooze:hover, .btn-stop:hover {
            background-color: #ff3a7f;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
});
