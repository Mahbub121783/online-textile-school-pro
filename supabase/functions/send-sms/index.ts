import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { phone, message, templateKey, placeholders, metadata } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has opted out of SMS
    if (metadata?.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('sms_opt_in')
        .eq('id', metadata.user_id)
        .single();
      if (profile?.sms_opt_in === false) {
        return new Response(
          JSON.stringify({ success: false, reason: 'User opted out of SMS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log the SMS attempt (provider integration is configurable)
    const { error: logError } = await supabase.from('sms_logs').insert({
      phone_number: phone,
      message,
      template_key: templateKey || null,
      status: 'pending',
      metadata: metadata || null,
    });

    if (logError) console.error('SMS log error:', logError);

    // TODO: Integrate with actual SMS provider (e.g., Twilio, BulkSMS BD, etc.)
    // For now, log and return success — admin configures provider credentials in setup
    // Example integration point:
    // const smsApiKey = Deno.env.get('SMS_API_KEY');
    // const smsApiUrl = Deno.env.get('SMS_API_URL');
    // if (smsApiKey && smsApiUrl) {
    //   const response = await fetch(smsApiUrl, { method: 'POST', body: JSON.stringify({ to: phone, msg: message }), headers: { 'Authorization': `Bearer ${smsApiKey}` } });
    //   // update sms_logs status based on response
    // }

    return new Response(
      JSON.stringify({ success: true, message: 'SMS queued for delivery' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
