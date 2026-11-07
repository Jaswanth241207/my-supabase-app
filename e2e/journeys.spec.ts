import { test, expect, type Page } from '@playwright/test'

// Needs a TEST Supabase project with migrations + sample menu, one confirmed customer and one admin account (see README).
const U = { email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD }
const A = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }
const ready = Boolean(U.email && U.password && A.email && A.password)

async function login(page: Page, u: { email?: string; password?: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(u.email!)
  await page.getByLabel('Password').fill(u.password!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/app/)
}

test.describe('Journey: order from menu to completion', () => {
  test.skip(!ready, 'Set E2E_USER_* and E2E_ADMIN_* to run')
  test('customer orders, admin walks it through the queue', async ({ browser }) => {
    const customer = await (await browser.newContext()).newPage()
    const admin = await (await browser.newContext()).newPage()

    await login(customer, U)
    await customer.goto('/app/menu')
    await customer.getByRole('button', { name: 'Add to cart' }).first().click()
    await customer.goto('/app/cart')
    await customer.getByRole('link', { name: /proceed to checkout/i }).click()
    await customer.getByRole('button', { name: /place order/i }).click()
    await expect(customer.getByText(/order placed/i)).toBeVisible()
    const heading = await customer.getByRole('heading', { name: /order #\d+/i }).textContent()
    const orderNo = heading!.match(/\d+/)![0]

    await login(admin, A)
    await admin.goto('/admin/orders')
    await admin.getByLabel('Order number').fill(orderNo)
    for (const step of ['Confirmed', 'Preparing', 'Ready for pickup', 'Completed']) {
      await admin.getByRole('button', { name: step, exact: true }).click()
      await admin.getByRole('button', { name: 'Confirm', exact: true }).click()
      await expect(admin.getByText(step, { exact: true }).first()).toBeVisible()
    }
    await customer.reload()
    await expect(customer.getByText('Completed').first()).toBeVisible()
  })
  test('customer cannot open the admin area', async ({ page }) => {
    await login(page, U)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/app$/)
  })
})
