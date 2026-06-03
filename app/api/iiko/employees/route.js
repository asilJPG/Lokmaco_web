import { http1Fetch } from "@/lib/iiko.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

export async function GET(request) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/bot_users?select=*&order=id.asc`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const employees = await res.json();
    return Response.json({ success: true, employees });
  } catch (e) {
    console.error("[/api/iiko/employees] GET error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, role, access_code, user } = await request.json();

    if (!user || user.role !== "admin") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!name || !role || !access_code) {
      return Response.json({ success: false, error: "Укажите имя, должность и код доступа" }, { status: 400 });
    }

    // Generate a unique random tg_id since tg_id cannot be null and must be unique
    const tg_id = Math.floor(100000000 + Math.random() * 900000000);

    const body = {
      name,
      role,
      access_code,
      tg_id
    };

    const res = await http1Fetch(`${SUPABASE_URL}/rest/v1/bot_users`, {
      method: "POST",
      headers: {
        ...getHeaders(),
        Prefer: "return=representation"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 409) {
      const errText = await res.text();
      let errorMsg = "Код доступа уже используется другим сотрудником";
      if (errText.includes("bot_users_tg_id_key")) {
        errorMsg = "Ошибка генерации ID. Попробуйте еще раз";
      }
      return Response.json({ success: false, error: errorMsg }, { status: 409 });
    }

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return Response.json({ success: true, employee: data[0] });
  } catch (e) {
    console.error("[/api/iiko/employees] POST error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const adminTgId = searchParams.get("adminTgId");

    if (!id) {
      return Response.json({ success: false, error: "Missing id" }, { status: 400 });
    }

    // Delete request
    const res = await http1Fetch(`${SUPABASE_URL}/rest/v1/bot_users?id=eq.${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("[/api/iiko/employees] DELETE error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, name, role, access_code, user } = await request.json();

    if (!user || user.role !== "admin") {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!id || !name || !role || !access_code) {
      return Response.json({ success: false, error: "Укажите все обязательные поля" }, { status: 400 });
    }

    const body = {
      name,
      role,
      access_code,
    };

    const res = await http1Fetch(`${SUPABASE_URL}/rest/v1/bot_users?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        ...getHeaders(),
        Prefer: "return=representation"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 409) {
      return Response.json({ success: false, error: "Код доступа уже используется другим сотрудником" }, { status: 409 });
    }

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return Response.json({ success: true, employee: data[0] });
  } catch (e) {
    console.error("[/api/iiko/employees] PUT error:", e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
