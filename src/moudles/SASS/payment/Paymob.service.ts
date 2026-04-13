import axios from "axios"
import crypto from "crypto"
import { AppError } from "../../../utils/classError"

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY!
const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET!
const BASE_URL = "https://accept.paymob.com/api"

// ── Integration IDs لكل طريقة دفع ────────────────────────────────────────────
const INTEGRATION_IDS = {
    card: process.env.PAYMOB_INTEGRATION_ID_CARD!,
    wallet: process.env.PAYMOB_INTEGRATION_ID_WALLET!,
}

const IFRAME_IDS = {
    card: process.env.PAYMOB_IFRAME_ID_CARD!,
}

export type PaymentMethod = "card" | "wallet"

// ─── Step 1: Auth Token ───────────────────────────────────────────────────────
const getAuthToken = async (): Promise<string> => {
    const res = await axios.post(`${BASE_URL}/auth/tokens`, { api_key: PAYMOB_API_KEY })
    return res.data.token
}

// ─── Step 2: Create Order ─────────────────────────────────────────────────────
const createOrder = async (
    authToken: string,
    amountCents: number,
    merchantOrderId: string
): Promise<string> => {
    const res = await axios.post(`${BASE_URL}/ecommerce/orders`, {
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: merchantOrderId,
        items: [],
    })
    return res.data.id
}

// ─── Step 3: Payment Key ──────────────────────────────────────────────────────
const getPaymentKey = async ({
    authToken, orderId, amountCents, billingData, method, saveCard = false, phone,
}: {
    authToken: string
    orderId: string
    amountCents: number
    billingData: { email: string; first_name: string; last_name: string; phone_number: string }
    method: PaymentMethod
    saveCard?: boolean
    phone?: string   // للمحافظ الإلكترونية
}): Promise<string> => {
    const integrationId = INTEGRATION_IDS[method]
    if (!integrationId) throw new AppError(`طريقة الدفع ${method} غير مفعّلة حالياً`, 400)

    const body: any = {
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: orderId,
        billing_data: {
            ...billingData,
            apartment: "NA", floor: "NA", street: "NA",
            building: "NA", shipping_method: "NA",
            postal_code: "NA", city: "NA", country: "EG", state: "NA",
        },
        currency: "EGP",
        integration_id: integrationId,
    }

    // حفظ الكارت للتجديد التلقائي (بطاقات فقط)
    if (method === "card" && saveCard) body.save_token = true

    // المحافظ الإلكترونية محتاجة رقم التليفون
    if (method !== "card" && phone) {
        body.billing_data.phone_number = phone
    }

    const res = await axios.post(`${BASE_URL}/acceptance/payment_keys`, body)
    return res.data.token
}

// ─── إنشاء رابط دفع ──────────────────────────────────────────────────────────
export const createPaymobPaymentLink = async ({
    amountEGP, merchantOrderId, billingData, method = "card", saveCard = false, phone,
}: {
    amountEGP: number
    merchantOrderId: string
    method?: PaymentMethod
    saveCard?: boolean
    phone?: string
    billingData: { email: string; first_name: string; last_name: string; phone_number: string }
}): Promise<{ iframeUrl?: string; redirectUrl?: string; orderId: string; paymentKey: string; method: PaymentMethod }> => {
    try {
        const amountCents = Math.round(amountEGP * 100)
        const authToken = await getAuthToken()
        const orderId = await createOrder(authToken, amountCents, merchantOrderId)

        const paymentKey = await getPaymentKey({
            authToken,
            orderId,
            amountCents,
            billingData,
            method,
            saveCard,
            ...(phone ? { phone } : {}),
        })

        // المحافظ الإلكترونية بتحتاج pay API مباشر مش iframe
        if (method === "wallet") {
            const walletPhone = phone || billingData.phone_number
            if (!walletPhone) throw new AppError("رقم الهاتف مطلوب للدفع بالمحفظة الإلكترونية", 400)

            const payRes = await axios.post(`${BASE_URL}/acceptance/payments/pay`, {
                source: {
                    identifier: walletPhone,
                    subtype: "WALLET",
                },
                payment_token: paymentKey,
            })

            const redirectUrl = payRes.data?.redirect_url || payRes.data?.iframe_redirection_url
            return { redirectUrl, orderId: String(orderId), paymentKey, method }
        }

        // البطاقات البنكية بتستخدم iframe
        const iframeId = IFRAME_IDS[method] ?? IFRAME_IDS.card
        const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`

        return { iframeUrl, orderId: String(orderId), paymentKey, method }
    } catch (err: any) {
        throw new AppError(`paymob error: ${err?.response?.data?.message ?? err.message}`, 500)
    }
}

// ─── تجديد تلقائي بـ Card Token (بطاقات فقط) ─────────────────────────────────
export const chargeWithToken = async ({
    amountEGP, merchantOrderId, cardToken, billingData,
}: {
    amountEGP: number
    merchantOrderId: string
    cardToken: string
    billingData: { email: string; first_name: string; last_name: string; phone_number: string }
}): Promise<{ success: boolean; transactionId?: string; error?: string }> => {
    try {
        const amountCents = Math.round(amountEGP * 100)
        const authToken = await getAuthToken()
        const orderId = await createOrder(authToken, amountCents, merchantOrderId)
        const paymentKey = await getPaymentKey({
            authToken, orderId, amountCents, billingData, method: "card",
        })

        const res = await axios.post(`${BASE_URL}/acceptance/payments/pay`, {
            source: { identifier: cardToken, subtype: "TOKEN" },
            payment_token: paymentKey,
        })

        return { success: res.data.success === true, transactionId: String(res.data.id) }
    } catch (err: any) {
        return { success: false, error: err?.response?.data?.message ?? err.message }
    }
}

// ─── HMAC Verification ────────────────────────────────────────────────────────
// export const verifyPaymobHmac = (body: any): boolean => {
//     const obj = body.obj ?? body
//     const {
//         amount_cents, created_at, currency, error_occured,
//         has_parent_transaction, id, integration_id, is_3d_secure,
//         is_auth, is_capture, is_refunded, is_standalone_payment,
//         is_voided, order, owner, pending,
//         source_data_pan, source_data_sub_type, source_data_type, success,
//     } = obj

//     const str = [
//         amount_cents, created_at, currency, error_occured,
//         has_parent_transaction, id, integration_id, is_3d_secure,
//         is_auth, is_capture, is_refunded, is_standalone_payment,
//         is_voided, order?.id, owner, pending,
//         source_data_pan, source_data_sub_type, source_data_type, success,
//     ].join("")

//     const hmac = crypto.createHmac("sha512", PAYMOB_HMAC_SECRET).update(str).digest("hex")
//     return hmac === body.hmac
// }

export const verifyPaymobHmac = (payload: any, receivedHmac?: string) => {
    if (!receivedHmac) return false

    const obj = payload.obj ?? payload

    // لازم ترتب وتكوّن string بالترتيب الرسمي من Paymob docs
    // المثال هنا مجرد هيكل، مش الترتيب النهائي
    const values = [
        obj.amount_cents ?? "",
        obj.created_at ?? "",
        obj.currency ?? "",
        obj.error_occured ?? "",
        obj.has_parent_transaction ?? "",
        obj.id ?? "",
        obj.integration_id ?? "",
        obj.is_3d_secure ?? "",
        obj.is_auth ?? "",
        obj.is_capture ?? "",
        obj.is_refunded ?? "",
        obj.is_standalone_payment ?? "",
        obj.is_voided ?? "",
        obj.order?.id ?? "",
        obj.owner ?? "",
        obj.pending ?? "",
        obj.source_data?.pan ?? "",
        obj.source_data?.sub_type ?? "",
        obj.source_data?.type ?? "",
        obj.success ?? "",
    ]

    const concatenated = values.map(v => String(v)).join("")
    const calculated = crypto
        .createHmac("sha512", process.env.PAYMOB_HMAC_SECRET!)
        .update(concatenated)
        .digest("hex")

    return calculated === String(receivedHmac).toLowerCase()
}

// ─── الطرق المتاحة ────────────────────────────────────────────────────────────
export const getAvailablePaymentMethods = (): { method: PaymentMethod; label: string; available: boolean }[] => [
    { method: "card", label: "بطاقة بنكية (Visa/Mastercard)", available: !!INTEGRATION_IDS.card },
    { method: "wallet", label: "محافظ إلكترونية (Vodafone/Orange/Etisalat/We)", available: !!INTEGRATION_IDS.wallet },
]