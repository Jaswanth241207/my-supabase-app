import { test, expect } from '@playwright/test'

test('landing page renders in the light theme', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /skip the queue, grab your bite/i })).toBeVisible()
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(255, 251, 245)')
})
test('protected routes redirect anonymous visitors to login', async ({ page }) => {
  for (const path of ['/app', '/app/menu', '/app/orders', '/admin']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  }
})
test('login form validates input without a backend', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Enter a valid email')).toBeVisible()
})
test('registration rejects weak passwords', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Test User')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText(/at least 10 characters/i).first()).toBeVisible()
})
