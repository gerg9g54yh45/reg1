/**
 * Задачи
 * 1. считать килы
 * 2. считать топ1
 * 3. матчи трио и соло (отдельно реги на них)
 * 
 * План
 * 1. получаем список всех зарегистрированных на соло и трио
 * 2. перебираем список запуская функцию для получения результатов (историю матчей)
 * 3. фильтруем историю матчей по времени, по типу игры
 * 4. фильтруем удаляя матчи которые уже были записаны ранее
 * 5. считаем килы и топ1 у новых матчей записывая в обьект (массив обьектов)
 * 6. если есть новые матчи то обновляем данные отправляя их в БД
 * 
 * для трио будет получатся статистика матча и там выбираться эти 3 игрока
 * по player.team лидера фильтроваться от других игроков
 * 
 * 7. иметь функцию которая сможет перебрать данные с БД и просумировать все килы и кол-во топ1 для каждой команды за все время
 */


let dataBase = {} // тут будет данные с БД
const leaderbordMess = {
    adv: {
        chId: "785476841807806494", // 782532677671976962
        id: "795542642971901973", // 782533035119607819
        body: null, // само сообщение
        data: null // текст сообщения
    },
    pro: {
        chId: "785476940957483008", // 782532710975537173
        id: "795542838434725970", // 782533046356148225
        body: null, // само сообщение
        data: null // текст сообщения
    }
}



const Config = require('./configs.js')
const config = Config.exports || Config
const TIMELENGTH = 1000 * 60 * 60 * 24 * 1 // 7 дней - длительность хаба
const TIMESTART = 1609750800000 // старт (12:00)
// const TIMECHECK = 1000 * 60 * 60 * 2 // 2 часа - как часто проверять команду (историю)
const TIMECHECK = 1000 * 60 * 15
const TIMEDURATIONMATCH = 1000 * 60 * 60 * 3 // время длительности старта без погрешности (для самих матчей)
const TIMELONGSTART = 1000 * 60 * 60 * 4 // время длительности старта с погрешностью, для начала проверок (3 часа + 1 час запас)
const API = require('call-of-duty-api')({ ratelimit: { maxRequests: 2, perMilliseconds: 20000, maxRPS: 2 } });
const MWcombatwz = wrapperLimiter(API.MWcombatwz.bind(API), 20000)
const MWFullMatchInfowz = wrapperLimiter(API.MWFullMatchInfowz.bind(API), 20000)

const {Client} = require('discord.js')
const client = new Client()
const request = require('request')






API.login(config.apiLogin, config.apiKey)
.then(logged => {
    console.log(` + Авторизация COD прошла успешно.`)
    // startCheckAllMatches()

    // загружаем данные с БД
    loadDBDate()
    .then(res => {
        if ( !res.status ) return showLogErr(res.e, res.err_msg)
            console.log(`Данные БД загруженны`)

        // запускаем бота
        client.login(config.tokenDiscord)
        client.on("ready", () => {
            console.log(` + Бот запущен!`)

            loadLeaderbordMessage() // загружает сообщение лидербода в память
            .then(res => {
                if ( !res.status ) return showLogErr(res.e, res.err_msg)

                client.user.setActivity('HUB', { type: 'WATCHING' })
                client.user.setStatus('online')
                client.on("message", startListenMess) // запускаем прослушку сообщений
                // startCheckAllMatches()
            })
            .catch(e => {
                showLogErr(e, "Ошибка загрузки сообщения лидерборда")
            })
        })
    })
    .catch(e => {
        showLogErr(e, "Ошибка загрузки данных бота с БД")
    })
})
.catch(e => {
    showLogErr(e, "Ошибка авторизации COD")
})






// ---> ДИСКОРД --->






function loadDBDate() {
    return new Promise(resolve => {
        sendSite({
			method: "POST",
			json: true,
			url: "https://webmyself.ru/hitbox/loadReg.php",
			form: {
				type: "load",
				token: config.dbToken
			}
        })
        .then(res => {
            const body = res.body
            if ( !body ) return resolve({status: false, err_msg: `Ошибка загрузки данных с БД - пустой body`})

            // body.status // сделать ?
            const data = body.data
            // console.log(data)
            data.forEach(team => {
                team.matches = (team.matches && team.matches != "null") ? JSON.parse(team.matches) : []

                team.lastCheck = team.last_сheck
                delete team.last_сheck

                team.timeStart = team.time_start
                delete team.time_start

                team.ownerId = team.owner_id
                delete team.owner_id

                team.teamName = team.team_name
                delete team.team_name

                team.teamActi = (team.team_acti && team.team_acti != "null") ? JSON.parse(team.team_acti) : []
                delete team.team_acti

                team.checkin = !!+team.checkin // делаем булевое значение
            })
            // console.log(data)

            dataBase = data
            return resolve({
                status: true
            })
        })
        .catch(e => {
            return resolve({status: false, e, err_msg: `Ошибка загрузки данных с БД`})
        })
    })
}



function loadLeaderbordMessage() {
    return new Promise(resolve => {
        const lbSolo = new Promise(resolve => {
            client.channels.fetch( leaderbordMess.adv.chId )
            .then(ch => {
                ch.messages.fetch( leaderbordMess.adv.id )
                .then(m => {
                    leaderbordMess.adv.body = m
                    console.log(`Сообщение загруженно`)
                    return resolve({status: true})
                })
            })
            .catch(e => {
                return resolve({status: false, e, err_msg: `Ошибка загрузка сообщения`})
            })
        })

        const lbTrio = new Promise(resolve => {
            client.channels.fetch( leaderbordMess.pro.chId )
            .then(ch => {
                ch.messages.fetch( leaderbordMess.pro.id )
                .then(m => {
                    leaderbordMess.pro.body = m
                    console.log(`Сообщение загруженно`)
                    return resolve({status: true})
                })
            })
            .catch(e => {
                return resolve({status: false, e, err_msg: `Ошибка загрузка сообщения`})
            })
        })

        Promise.all([lbSolo, lbTrio])
        .then(res => {
            if ( res[0].status && res[1].status ) return resolve({status: true})
            return resolve({status: false, data: res})
        })
    })
}



function startListenMess(message) {
    if (message.author.bot) return false // если сообщение от бота то игнорим
	let content = message.content.replace(/[\\\n]+/, '').trim()
    const authorId = message.author.id
    const channelId = message.channel.id

	/**
	 * выполняет код создателя бота внутри, нужно для тестирования и отладки
	 */
	if (authorId == "510112915907543042" && content.toLowerCase().startsWith("!con ")) {
		try {
			console.log(+getNewDate(), getNewDate())
			eval( content.slice(5) )
			return;
		} catch (e) {
			return console.log(e)
		}
    }

    if ( channelId == "768390652559360000" && content.toLowerCase().startsWith("!start") ) {
        return executeStart(message)
    }
}


function executeStart(message) {
    console.log("executeStart")
    const id = message.author.id

    const team = getTeamForId(id)
    if ( !team ) return message.reply(`Вы не являетесь лидером команды.`)

    if ( !team.checkin ) return message.reply(`Вы не прожали "checkin" (на сайте).`)

    const date = +getNewDate()
    if ( team.timeStart && date - team.timeStart < TIMEDURATIONMATCH ) {
        const timelate = TIMEDURATIONMATCH - (date - team.timeStart) // сколько прошло времени
        return message.reply(`Старт уже был прописан! вам осталось играть: ${timelate}ms.`)
    }

    team.timeStart = date
    // отправляем изменения на сервер
    sendTeamUpdates(team)
    .then(res => {
        console.log(`Обновление timeStart ${team.teamName} успешно завершено!`)
        return message.reply(`Начинайте играть!`)
    })
    .catch(e => {
        team.timeStart = ''
        showLogErr(e, `Ошибка при timeStart команды "sendTeamUpdates": ${team.teamName}`)
        return message.replay(`Ошибка!`)
    })
}



function getTeamForId(id) { // находит тиму по id овнера
    return dataBase.find(team => {
        return team.ownerId == id
    })
}


function formDataMinute(time) {
    let hours = 0
    let minute = 0
    let seconds = 0

    time = time / 1000 / 60 // кол-во минут
    minute = Math.trunc(time)
    seconds = (time + "").replace(/[0-9]+\./, '') * 60 / 100

    if ( minute > 60 ) { // если есть часы
        hours = minute / 60
        minute = minute - hours * 60
        // minute = (hours + "").replace(/[0-9]+\./, '')
        hours = Math.trunc(hours)
    }

    return {hours, minute, seconds}
}



// создает и добавляет роль
function addRoleUsers(message, rolename) {
    message.guild.roles.create({
        data: {name: rolename}
    })
    .then(role => {
        // добавляем роль
        const member = message.guild.member(message.author)
        if (!member) {
            console.log(`Пользователь вышел с сервера.`)
        }

        member.roles.add(role.id)
        .then(r => {
            console.log(`Роль успешно добавленна`)
        })
        .catch(e => {
            console.log(`Ошибка добавления роли: ${rolename}.`)
        })
    })
    .catch(e => {
        console.log(`Ошибка создания роли: ${rolename}.`)
    })
}



// поулчает id роли по имени
function getIdRole(rolename) {
    const guild = client.guilds.cache.get("768390157400670209") // 505374650730283008
    const roles = guild.roles
    // console.log(roles)
    const roleFind = roles.cache.filter(role => role.name == rolename)
    const roleArray = roleFind.array()
    // console.log( roleArray )
    if ( roleArray.length == 0 ) return false // если роль ненайдена
    return roleArray[0].id
}






// <--- ДИСКОРД <---
//
//
//
//
//
//
// ---> ПАРСИНГ МАТЧЕЙ --->






// запускает проверку всех матчей всех команд всех хабов
// она будет делаться для каждой команды раз в 2 часа
function startCheckAllMatches() {
    // getNameForActiId

    // перебираем команды checkTime
    dataBase.forEach(team => {
        if ( !team.checkin ) return; // пропускаем команды которые не прожали checkin
        if ( !team.timeStart ) return; // если даже незапущен то прпоускаем
        const newCheck = +getNewDate()
        if ( newCheck - team.lastCheck < TIMECHECK ) return; // пропускаем если время не прошло (TIMECHECK)
        if ( newCheck - team.timeStart > TIMELONGSTART ) return; // пропускаем если время после старта прошло больше нужного (сама првоерка)

        // console.log(team, "прошло")
        // иначе получаем историю матчей запустив нужную функцию
        if ( team.division == "HCL Advanced division" && team.teamActi.length == 1 ) return executeAdv(team)
        if ( team.division == "HCL Pro division" && team.teamActi.length == 3 ) return executePro(team)
        return showLogErr(team, `division не определен: ${team.division}`)
    })
}



function executeAdv(team) {
    // сначала получаем историю капитана
    const ownActi = team.teamActi[0]
    getHistory( ownActi )
    .then(response => {
        if ( !response.status ) return showLogErr(response.e, response.err_msg)

        const matches = response.data
        if ( !matches.length ) return showLogErr(team, `история матчей пуста`)

        // фильтруем историю матчей
        // console.log(`DO: ----------------------`)
        // console.log(matches)
        matches.filterMatches(team.matches, "br_brtrios", team.timeStart)
        // console.log(`POSLE: ----------------------`)
        // console.log(matches)
        // console.log(`\n\n\n`)

        if ( !matches.length ) return showLogErr(team, `нет подходящих матчей (после фильтрации)`)
        const allMatchesPromise = [] // массив содержащий промисы всех матчей, что бы потом запустить обновление 1 раз в самом конце

        matches.forEach(match => {
            const matchesPromise = getMatchForId(match.matchID)
            allMatchesPromise.push(matchesPromise) // добавляем промис

            matchesPromise
            .then(response => {
                if ( !response.status ) return showLogErr(response.e, response.err_msg)

                const allPlayers = response.data.allPlayers
                if ( !allPlayers || !allPlayers.length ) return showLogErr(team, `нет игроков в матче`)

                // получаем команду из матча по acti лидера
                const teamOnMatch = getTeamOnMatch(allPlayers, team.teamActi)
                // console.log(` -------- TEAM:`)
                // console.log(teamOnMatch)

                // складываем их очки
                const sumKills = teamOnMatch.reduce(function(sum, current) {
                    return sum + current.playerStats.kills
                }, 0)

                // вносим изменения локально
                team.matches.push({
                    id: match.matchID,
                    kills: sumKills
                })
            })
            .catch(e => {
                showLogErr(e, `Ошибка getMatchForId ${match.matchID}`)
            })
        })

        // ждем когда закончится првоерка всех матчей
        Promise.all(allMatchesPromise)
        .then(res => {
            console.log(` + Проверка всех матчей команды ${team.teamName} закончена`)
            // раз все успешно закончилось то обновляем время последнего обновления
            team.lastCheck = +getNewDate()

            // отправляем изменения на сервер
            // console.log(team)
            sendTeamUpdates(team)
            .then(res => {
                console.log(`Обновление команды ${team.teamName} успешно завершено!`)
            })
            .catch(e => {
                showLogErr(e, `Ошибка при обновлении команды "sendTeamUpdates": ${team.teamName}`)
            })
        })
        .catch(e => {
            showLogErr(e, `Ошибка во время ожидания конца всех промисов поулчания матчей команды ${team.teamName}`)
        })
    })
    .catch(e => {
        showLogErr(e, `Ошибка при получении истории матчей ADV для ${team.teamName}; ${ownActi}`)
    })
}



function executePro(team) {
    // сначала получаем историю капитана
    const ownActi = team.teamActi[0]
    getHistory( ownActi )
    .then(response => {
        if ( !response.status ) return showLogErr(response.e, response.err_msg)

        const matches = response.data
        if ( !matches.length ) return showLogErr(team, `история матчей пуста`)

        // фильтруем историю матчей
        // console.log(`DO: ----------------------`)
        // console.log(matches)
        matches.filterMatches(team.matches, "br_brtrios", team.timeStart)
        // console.log(`POSLE: ----------------------`)
        // console.log(matches)
        // console.log(`\n\n\n`)

        if ( !matches.length ) return showLogErr(team, `нет подходящих матчей (после фильтрации)`)
        const allMatchesPromise = [] // массив содержащий промисы всех матчей, что бы потом запустить обновление 1 раз в самом конце

        matches.forEach(match => {
            const matchesPromise = getMatchForId(match.matchID)
            allMatchesPromise.push(matchesPromise) // добавляем промис

            matchesPromise
            .then(response => {
                if ( !response.status ) return showLogErr(response.e, response.err_msg)

                const allPlayers = response.data.allPlayers
                if ( !allPlayers || !allPlayers.length ) return showLogErr(team, `нет игроков в матче`)

                // получаем команду из матча по acti лидера
                const teamOnMatch = getTeamOnMatch(allPlayers, team.teamActi)
                // console.log(` -------- TEAM:`)
                // console.log(teamOnMatch)

                // складываем их очки
                const sumKills = teamOnMatch.reduce(function(sum, current) {
                    return sum + current.playerStats.kills
                }, 0)

                // вносим изменения локально
                team.matches.push({
                    id: match.matchID,
                    kills: sumKills
                })
            })
            .catch(e => {
                showLogErr(e, `Ошибка getMatchForId ${match.matchID}`)
            })
        })

        // ждем когда закончится првоерка всех матчей
        Promise.all(allMatchesPromise)
        .then(res => {
            console.log(` + Проверка всех матчей команды ${team.teamName} закончена`)
            // раз все успешно закончилось то обновляем время последнего обновления
            team.lastCheck = +getNewDate()

            // отправляем изменения на сервер
            // console.log(team)
            sendTeamUpdates(team)
            .then(res => {
                console.log(`Обновление команды ${team.teamName} успешно завершено!`)
            })
            .catch(e => {
                showLogErr(e, `Ошибка при обновлении команды "sendTeamUpdates": ${team.teamName}`)
            })
        })
        .catch(e => {
            showLogErr(e, `Ошибка во время ожидания конца всех промисов поулчания матчей команды ${team.teamName}`)
        })
    })
    .catch(e => {
        showLogErr(e, `Ошибка при получении истории матчей PRO для ${team.teamName}; ${ownActi}`)
    })
}




/**
 * получает историю матчей по активижн ИД
 * @param {String} actiId - активижн ид
 * @return {Promise, Object} - {status, data, err_msg, e}
 */
function getHistory(actiId) {
    return new Promise(resolve => {
        console.log(`Получаем историю матчей ${actiId}`)

        MWcombatwz(actiId, "acti")
        .then(res => {
            if ( !res ) return resolve({
                status: false,
                err_msg: `!res`
            })

            const matches = res.matches
            if ( !matches ) return resolve({
                status: false,
                err_msg: `!matches - матчи не найдены ${actiId}`
            })
            
            return resolve({
                status: true,
                data: matches
            })
        })
        .catch(e => {
            return resolve({
                status: false,
                err_msg: `catch - аккаунт (${actiId}) не найден или скрыт (скорее всего)`,
                e: e
            })
        })
    })
}



function getMatchForId(id) {
    return new Promise(resolve => {
        console.log(`Получаем матч по id: ${id}`)
        MWFullMatchInfowz(id, "acti")
        .then(res => {
            if ( !res ) return resolve({
                status: false,
                err_msg: `!res`
            })

            return resolve({
                status: true,
                data: res
            })
        })
        .catch(e => {
            return resolve({
                status: false,
                err_msg: `catch - матч ${id} не найден`,
                e: e
            })
        })
    })
}


// отправляет все изменения команды ан сервер
function sendTeamUpdates(team) {
    return sendSite({
        method: "POST",
        json: true,
        url: "https://webmyself.ru/hitbox/loadReg.php",
        form: {
            type: "update",
            token: config.dbToken,
            team
        }
    })
}



/**
 * фильтр матчей по времени и моду (тип игры)
 * @param {Array} teamMatches - массив матчей которые уже записаны что бы не брать те, которые еще не записаны
 * @param {String} mode - фильтр по моду
 */
Array.prototype.filterMatches = function(teamMatches, mode, timeStart) {
    if ( this.length == 0 ) return this

    for (let i = 0; i < this.length; i++) {
        const match = this[i]
        // console.log(`mode: ${mode} = ${match.mode == mode}; utcStartSeconds: ${match.utcStartSeconds} = ${checkTime(match.utcStartSeconds)}`)
        const utcSS = match.utcStartSeconds
        if ( match.mode == mode && checkTime(utcSS) && !teamMatches.find(m => m.id == match.matchID) && checkTime2(utcSS, timeStart) ) {
            console.log(`оставляем матч ${match.matchID}; матчи тимы:`)
            console.log(teamMatches)
            console.log(`\n`)
            continue; // оставляем (не удаляем)
        }
        this.splice(i, 1)
        i--
    }
}



/**
 * првоеряет входит ли этот промежуток времени в нужный
 * @param {*} timeMatch - время матча
 */
function checkTime(timeMatch) {
	timeMatch *= 1000 // превращаем в мс
	return (timeMatch - TIMESTART) > 0 && (timeMatch - TIMESTART) < TIMESTART + TIMELENGTH
}

function checkTime2(timeMatch, timeStart) {
    timeMatch *= 1000 // превращаем в мс
    console.log(`timeMatch: ${timeMatch}; timeStart: ${timeStart}; TIMEDURATIONMATCH: ${TIMEDURATIONMATCH}`)
	return timeMatch > timeStart && timeMatch < (timeStart + TIMEDURATIONMATCH)
}



/**
 * получаем команду из матча по acti лидера
 * @param {Array} allPlayers - список игроков матча поулченный по id матча
 * @param {String} teamActi - acti команды
 * @return {Array, Boolean} - массив команды либо false если ошибка
 */
function getTeamOnMatch(allPlayers, teamActi) {
    try {
        const ownerActi = teamActi[0] // acti капитана
        const ownerList = allPlayers.filter(function(user) {
            return user.player.username.toLowerCase() == getNameForActiId(ownerActi).toLowerCase()
        })

        if ( !ownerList || ownerList.length != 1 ) return false // если длина массива не равно 0 то ошибка (найдено 0 или больше 1 человека)

        const owner = ownerList[0]
        const team = allPlayers.filter(user => {
            // совпадают команды И юзернейм есть в тиме (челы котоыре были зареганы)
            return user.player.team == owner.player.team && teamActi.find( acti => getNameForActiId(acti).toLowerCase() == user.player.username.toLowerCase() )
        })

        return team
    } catch(e) {
        showLogErr(e, `Оишбка getTeamOnMatch - uno: ${uno}`)
        return false
    }
}


function getSumKills(team) {
    return team.matches.reduce((sum, match) => {
        return +match.kills + sum
    }, 0)
}

// обновляет лидерборды соло и трио суммируя все очки
function hubLeaderbordUpdate() {
    const soloFullTeam = [],
        trioFullTeam = []
    dataBase.forEach(team => { // добавляем полностью созданные тимы в массивы
        if ( team.division == "HCL Advanced division" ) return soloFullTeam.push(team)
        // if ( team.division == "HCL Advanced division" && team.teamActi.length == 1 ) return soloFullTeam.push(team)
        if ( team.division == "HCL Pro division" ) return trioFullTeam.push(team)
    })

    if ( soloFullTeam.length > 30 ) soloFullTeam.length = 30 // ограничение на вывод 30 команд
    if ( trioFullTeam.length > 30 ) trioFullTeam.length = 30 // ограничение на вывод 30 команд

    // сортируем команды по очкам
    soloFullTeam.sort((teamA, teamB) => {
        return getSumKills(teamB) - getSumKills(teamA)
    })

    trioFullTeam.sort((teamA, teamB) => {
        return getSumKills(teamB) - getSumKills(teamA)
    })

    // формируем текст из массивов
    let messageSoloLeaderbord = {
        embed: {
            title: `HCL Advanced division`,
            color: 15170518,
            description: `**Топ 30 команд:**\n`
        }
    }
    for (let i = 0; i < soloFullTeam.length; i++) {
        const team = soloFullTeam[i]
        const roleId = getIdRole(team.teamName)
        const text = roleId ? `<@&${roleId}>` : team.teamName

        const sumKills = team.matches.reduce((sum, match) => {return +match.kills + sum}, 0)

        messageSoloLeaderbord.embed.description += `\n${i+1}. ${text} - ${sumKills}`
    }

    let messageTrioLeaderbord = {
        embed: {
            title: `HCL Pro division`,
            color: 15170518,
            description: `**Топ 30 команд:**\n`
        }
    }
    for (let i = 0; i < trioFullTeam.length; i++) {
        const team = trioFullTeam[i]
        const roleId = getIdRole(team.teamName)
        const text = roleId ? `<@&${roleId}>` : team.teamName

        const sumKills = team.matches.reduce((sum, match) => {return +match.kills + sum}, 0)

        messageTrioLeaderbord.embed.description += `\n${i+1}. ${text} - ${sumKills}`
    }

    // обновляем текст сообщений лидерборда
    leaderbordMess.adv.body.edit(messageSoloLeaderbord)
    leaderbordMess.pro.body.edit(messageTrioLeaderbord)
}






// <--- ПАРСИНГ МАТЧЕЙ <---






// ---> ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ --->



// удаляет хэш и цифры после него из активижн ид
function getNameForActiId(actiId) {
    return actiId.replace(/#\d+$/, "")
}



/**
 * выводит в консоль ошибку правильно оформленную
 * @param {*} err - сама ошибка
 * @param {*} text - основной текст описывающий ошибку
 */
function showLogErr(err="", text="") {
    console.log(` - ${text}. err:`)
    console.log(err)
    console.log(` ---\n`)
}



function sendSite(params) {
	if (!params.strictSSL) params.strictSSL = false
	params.url = encodeURI(params.url)
	const send = params.method == "POST" ? request.post : request.get

	return new Promise((resolve, reject) => {
		send(params, function (error, response) {
			if (error) reject(error)
		  return resolve(response)
		})
	})
}



/**
 * возвращает функцию обертку которая выполняется не чаще чем указанное время при создании обертки
 * @param {*} func - функция обертку для которой мы будем делать
 * @param {*} time - время, не чаще которого функция может быть выполнена
 */
function wrapperLimiter(func, time=1000) {
    let lastStart = 0 // последний запуск функции с учетом очереди!

    return function() {
        if ( lastStart < getNewDate() - 1000 ) {
            // если функция давно не вызывалась то запускаем ее сейчас
            lastStart = +getNewDate()
            return new Promise(resolve => resolve( func.apply(this, arguments) ))
        } else {
            // если функция стоит в очереди запуска
            const timeNext = lastStart - getNewDate() + time // время через которое функция будет запущенна
            lastStart += time
            return new Promise(resolve => {
                setTimeout(() => {
                    return resolve( func.apply(this, arguments) )
                }, timeNext)
            })
        }
    }
}





function getNewDate() {
    return new Date( +new Date() + 1000 * 60 * 60 * 3 )
}
setInterval(hubLeaderbordUpdate, 1000 * 60 * 5) // каждые 5 минут обновление лидерборда матчей
setInterval(startCheckAllMatches, 1000 * 60 * 30) // каждые 30 минут чекаем стату всех матчей