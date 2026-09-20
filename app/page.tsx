import { supabase } from "@/lib/supabase";

export default async function Home() {
    const { data: captions, error } = await supabase
        .from("captions")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        return <p>Error loading captions: {error.message}</p>;
    }

    return (
        <main
            style={{
                maxWidth: "700px",
                margin: "0 auto",
                padding: "60px 24px",
            }}
        >
            <h1>Caption Ratings</h1>

            <p>Captions loaded from Supabase</p>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    marginTop: "32px",
                }}
            >
                {captions?.map((caption) => (
                    <div
                        key={caption.id}
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: "12px",
                            padding: "20px",
                        }}
                    >
                        <p>{caption.caption}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}