/*
  Public API
*/

// Persistent
SupportNotifications = {
  version: "1.0.0",
  providers: {},
  Notifications: {
    interval: 1,
    sound_on: true,
    notifications_on: true
  },
  TicketProvider : function(name, properties) {
    this.name = name;
    this.enabled = false;
    for(var propName in properties) {
      this[propName] = properties[propName];
    }
  }
};
// Non-persistent
Tickets = {};

// Load from local storage
function loadConfig(masterPassword) {
  if(localStorage.data !== undefined) {
    try {
      var encrypted = JSON.parse(localStorage.data);
      SupportNotifications = JSON.parse(sjcl.decrypt(masterPassword, encrypted));
    } catch(err) {
      console.log(err);
      return false;
    }
  }

  // Mix in provider functions
  for(var providerName in SupportNotifications.providers) {
    SupportNotifications.providers[providerName].__proto__ = 
      window[providerName];
  }
  
  return true;
}

/*
  Saves configuration to local storage.
  Returns true if the master password was long enough
  and data was saved to disk.
*/
function saveConfig(masterPassword) {
  if(masterPassword.length > 5) {
    var json = JSON.stringify(SupportNotifications);
    var encrypted = sjcl.encrypt(masterPassword, json);
    localStorage.data = JSON.stringify(encrypted);
    return true;
  }
  return false;
}

/*
  Private API
*/

// Initial string to use for lastTicketCreated
function _defaultTicketDate() {
  function _twodigits(number) {
    if(number <= 9) { return "0" + number};
    return number.toString();
  }
  var now = new Date();
  return [now.getFullYear(), _twodigits(now.getMonth()+1), 
    _twodigits(now.getDate())].join("/");
}

function _notifyAboutTicket(provider, ticket) {
  var notification = webkitNotifications.createNotification('lgpl/48.png', 
                                                            provider.name, 
                                                            ticket.subject)
  notification.onclick = function() {
    chrome.tabs.create({'url': provider.getTicketURL(ticket)});
  }
  notification.show();
}

function _scheduleStatusUpdate() {
  var interval = SupportNotifications.Notifications.interval * 60 * 1000;
  setTimeout(function() { updateStatus(); _scheduleStatusUpdate(); }, interval);
}

function _updateProviderStatus(providerName, provider) {
  var ticketData = provider.getTicketData();
  var tickets = ticketData.tickets;
  //Alert about all new tickets
  var newTickets = false;
  var storageVar = providerName + ".lastTicketCreated";
  var lastTicketCreated = localStorage[storageVar] || _defaultTicketDate();
  var i = tickets.length;
  while(i--) {
    var ticket = tickets[i];
    if (ticket.created_at > lastTicketCreated) {
      if(SupportNotifications.Notifications.notifications_on) {
        newTickets = true;
        _notifyAboutTicket(provider, ticket);
      }
      lastTicketCreated = ticket.created_at;
    }
  }
  localStorage[storageVar] = lastTicketCreated;
  Tickets[providerName] = {latestTicket: tickets[0], total: ticketData.total};
  return newTickets;
}

function updateStatus() {
  var numTickets = 0;
  var newTickets = false;
  for(var providerName in SupportNotifications.providers) {
    var provider = SupportNotifications.providers[providerName];
    if(provider.enabled) {
      try {
        if(_updateProviderStatus(providerName, provider)) {
          newTickets = true;
        }
        numTickets += Tickets[providerName].total;
      }
      catch(err) {
        console.log(err); // Provider not available?
      }
    }
  }
  
  chrome.browserAction.setBadgeText({text: numTickets.toString()});
  if (newTickets && SupportNotifications.Notifications.sound_on) {
    var audio = document.getElementById("notification_audio");
    audio.play();
  }
}

/*
  Initialization
*/
_scheduleStatusUpdate();
chrome.browserAction.setBadgeBackgroundColor({color: [255, 188, 66, 255] });
chrome.browserAction.setBadgeText({text: "?" });