import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAdmin.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user.id;

    const body = await req.json();
    const { action } = body;

    // ── VERIFY existing payment ──
    if (action === "verify") {
      const { invoice_id } = body;
      if (!invoice_id) {
        return new Response(
          JSON.stringify({ error: "invoice_id required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get UddoktaPay API key
      const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Payment gateway not configured" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get gateway config for API URL
      const { data: gateway } = await supabaseAdmin
        .from("payment_gateways")
        .select("credentials")
        .eq("gateway_name", "uddoktapay")
        .eq("is_active", true)
        .single();

      const apiUrl = (gateway?.credentials as any)?.api_url || "https://sandbox.uddoktapay.com/api";

      // Verify with UddoktaPay
      const verifyRes = await fetch(`${apiUrl}/verify-payment`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "RT-UDDOKTAPAY-API-KEY": apiKey,
        },
        body: JSON.stringify({ invoice_id }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.status === "COMPLETED") {
        // Find order by payment_reference
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, user_id, status")
          .eq("payment_reference", invoice_id)
          .single();

        if (order && order.status !== "completed") {
          // Update order status
          await supabaseAdmin
            .from("orders")
            .update({ status: "completed", payment_reference: invoice_id })
            .eq("id", order.id);

          // Update invoice
          await supabaseAdmin
            .from("invoices")
            .update({
              payment_status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("order_id", order.id);

          // Create enrollments for course items
          const { data: orderItems } = await supabaseAdmin
            .from("order_items")
            .select("item_id, item_type, price")
            .eq("order_id", order.id);

          // Get user info for emails
          const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
          const userEmail = userAuth?.user?.email;
          const { data: userProf } = await supabaseAdmin
            .from("user_profiles")
            .select("full_name")
            .eq("id", order.user_id)
            .single();
          const userName = userProf?.full_name || "Student";
          const siteUrl = Deno.env.get("SITE_URL") || "https://learn-textile-hub.lovable.app";

          // Send payment receipt email
          if (userEmail) {
            try {
              await supabaseAdmin.functions.invoke("send-smtp-email", {
                body: {
                  templateKey: "payment_received",
                  recipientEmail: userEmail,
                  placeholders: {
                    user_name: userName,
                    amount: String(order.total ?? ""),
                    payment_method: "UddoktaPay",
                    invoice_number: invoice_id,
                    invoice_url: `${siteUrl}/dashboard/invoices`,
                  },
                },
              });
            } catch (e) { console.warn("payment_received email failed:", e); }
          }

          if (orderItems) {
            for (const item of orderItems) {
              if (item.item_type === "course") {
                await supabaseAdmin.from("enrollments").upsert(
                  {
                    user_id: order.user_id,
                    course_id: item.item_id,
                    payment_id: order.id,
                  },
                  { onConflict: "user_id,course_id" }
                );

                // Get course info for email + revenue share
                const { data: course } = await supabaseAdmin
                  .from("courses")
                  .select("instructor_id, revenue_share_pct, title, slug")
                  .eq("id", item.item_id)
                  .single();

                // Send enrollment confirmation
                if (userEmail && course) {
                  try {
                    await supabaseAdmin.functions.invoke("send-smtp-email", {
                      body: {
                        templateKey: "enrollment_confirmation",
                        recipientEmail: userEmail,
                        placeholders: {
                          user_name: userName,
                          course_name: course.title,
                          course_url: `${siteUrl}/courses/${course.slug}`,
                        },
                      },
                    });
                  } catch (e) { console.warn("enrollment email failed:", e); }
                }

                if (course?.instructor_id) {
                  const sharePct = Number(course.revenue_share_pct ?? 70);
                  const instructorAmount = (Number(item.price) * sharePct) / 100;
                  if (instructorAmount > 0) {
                    await supabaseAdmin.rpc("credit_wallet", {
                      _user_id: course.instructor_id,
                      _amount: instructorAmount,
                      _description: `Revenue from order ${order.id.slice(0, 8)}`,
                      _reference_id: order.id,
                    });
                  }
                }
              } else if (item.item_type === "ebook") {
                // Send ebook purchase email
                const { data: ebook } = await supabaseAdmin
                  .from("ebooks")
                  .select("title, author, slug")
                  .eq("id", item.item_id)
                  .single();
                if (userEmail && ebook) {
                  try {
                    await supabaseAdmin.functions.invoke("send-smtp-email", {
                      body: {
                        templateKey: "ebook_purchase",
                        recipientEmail: userEmail,
                        placeholders: {
                          user_name: userName,
                          ebook_title: ebook.title,
                          ebook_author: ebook.author || "Author",
                          ebook_download_url: `${siteUrl}/ebooks/${ebook.slug}`,
                        },
                      },
                    });
                  } catch (e) { console.warn("ebook_purchase email failed:", e); }
                }
              }
            }
          }

          // Credit referrer if this user was referred
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("referred_by")
            .eq("id", order.user_id)
            .single();

          if (profile?.referred_by) {
            // Update referral reward to credited
            await supabaseAdmin
              .from("referral_rewards")
              .update({ status: "credited", reward_amount: 50, credited_at: new Date().toISOString() })
              .eq("referred_id", order.user_id)
              .eq("status", "pending");

            // Credit referrer wallet
            await supabaseAdmin.rpc("credit_wallet", {
              _user_id: profile.referred_by,
              _amount: 50,
              _description: `Referral reward for order ${order.id.slice(0, 8)}`,
              _reference_id: order.id,
            });
          }
        }

        return new Response(
          JSON.stringify({ status: "COMPLETED", invoice_id }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ status: verifyData.status || "PENDING" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── CREATE new payment ──
    const { orderId, amount, customerName, customerEmail, customerPhone, metadata } = body;

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: "orderId and amount required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get gateway config
    const { data: gateway } = await supabaseAdmin
      .from("payment_gateways")
      .select("credentials")
      .eq("gateway_name", "uddoktapay")
      .eq("is_active", true)
      .single();

    if (!gateway) {
      return new Response(
        JSON.stringify({ error: "UddoktaPay gateway not active" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creds = gateway.credentials as any;
    const apiUrl = creds?.api_url || "https://sandbox.uddoktapay.com/api";
    const siteUrl = Deno.env.get("SITE_URL") || "https://learn-textile-hub.lovable.app";

    // Create UddoktaPay checkout
    const checkoutRes = await fetch(`${apiUrl}/checkout-v2`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({
        full_name: customerName || "Customer",
        email: customerEmail || "customer@example.com",
        amount: amount.toString(),
        metadata: {
          order_id: orderId,
          user_id: userId,
          ...(metadata || {}),
        },
        redirect_url: `${siteUrl}/payment/success?invoice_id=`,
        cancel_url: `${siteUrl}/payment/cancel`,
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-payment-webhook`,
      }),
    });

    const checkoutData = await checkoutRes.json();

    if (checkoutData.payment_url) {
      // Save the invoice_id as payment reference
      await supabaseAdmin
        .from("orders")
        .update({ payment_reference: checkoutData.invoice_id })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({
          payment_url: checkoutData.payment_url,
          invoice_id: checkoutData.invoice_id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: checkoutData.message || "Failed to create payment" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("process-payment error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
