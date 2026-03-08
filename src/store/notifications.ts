const KEY_ENABLED = 'volt_notifications_enabled'
const KEY_TRANSACTION_ALERTS = 'volt_notifications_transaction_alerts'
const KEY_NOTIFY_RECEIVE = 'volt_notify_receive'
const KEY_NOTIFY_SEND = 'volt_notify_send'

export function getNotificationsEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY_ENABLED)
    return v === 'true'
  } catch {
    return true
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_ENABLED, String(enabled))
  } catch {
    // ignore
  }
}

export function getTransactionAlertsEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY_TRANSACTION_ALERTS)
    return v !== 'false'
  } catch {
    return true
  }
}

export function setTransactionAlertsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_TRANSACTION_ALERTS, String(enabled))
  } catch {
    // ignore
  }
}

export function getNotifyOnReceive(): boolean {
  try {
    const v = localStorage.getItem(KEY_NOTIFY_RECEIVE)
    return v !== 'false'
  } catch {
    return true
  }
}

export function setNotifyOnReceive(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_NOTIFY_RECEIVE, String(enabled))
  } catch {
    // ignore
  }
}

export function getNotifyOnSend(): boolean {
  try {
    const v = localStorage.getItem(KEY_NOTIFY_SEND)
    return v !== 'false'
  } catch {
    return true
  }
}

export function setNotifyOnSend(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_NOTIFY_SEND, String(enabled))
  } catch {
    // ignore
  }
}
