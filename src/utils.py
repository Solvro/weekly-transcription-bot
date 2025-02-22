from typing import List, Dict
from pydub import AudioSegment
from openai import OpenAI
import math, os

def meetings_info(meetings_dir: str) -> List[Dict]:
    meetings_info = []
    
    for meeting_folder in os.listdir(meetings_dir):
        folder_path = os.path.join(meetings_dir, meeting_folder)
        
        if os.path.isdir(folder_path):
            contains_mp3 = False
            contains_md = False
            contains_txt = False

            for file_name in os.listdir(folder_path):
                if file_name.endswith('.mp3'):
                    contains_mp3 = True
                elif file_name.endswith('.md'):
                    contains_md = True
                elif file_name.endswith('.txt'):
                    contains_txt = True
                    
            meetings_info.append({
                'name': meeting_folder,
                'recorded': contains_mp3,
                'transcribed': contains_txt,
                'summarized': contains_md
            })
    
    return meetings_info

def split_audio(file_path: str, max_size_mb=25) -> List[str]:
    audio = AudioSegment.from_mp3(file_path)
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    
    if file_size_mb < max_size_mb:
        return [file_path]
    
    num_chunks = math.ceil(file_size_mb / max_size_mb)
    chunk_length_ms = len(audio) / num_chunks

    chunk_paths = []
    for i in range(num_chunks):
        start_ms = i * chunk_length_ms
        end_ms = start_ms + chunk_length_ms
        chunk = audio[start_ms:end_ms]
        
        chunk_path = f"{file_path}_chunk_{i+1}.mp3"
        chunk.export(chunk_path, format="mp3")
        chunk_paths.append(chunk_path)
    
    return chunk_paths

def transcribe_audio(file_path: str, openai_client: OpenAI, model_: str, lang_: str):   
    with open(file_path, "rb") as audio_file:
        response = openai_client.audio.transcriptions.create(
            model=model_,
            file=audio_file,
            language=lang_,
        )

    return response

def transcribe(file_path, openai_api_key: str, model_: str, lang_: str, split_size=25):
    chunk_paths = split_audio(file_path, split_size)
    full_transcription = ""
    
    client = OpenAI(api_key=openai_api_key)
    
    for chunk_path in chunk_paths:
        response = transcribe_audio(chunk_path, client, model_, lang_)
        transcription_text = response.text
        full_transcription += transcription_text + " "

        if len(chunk_paths) > 1:
            os.remove(chunk_path)
    
    return full_transcription

def save_transcription(transcription: str, output_path: str):
    with open(output_path, "w", encoding="utf-8") as txt_file:
        txt_file.write(transcription)
        
def summarize_transcription(transcription_path: str, openai_api_key: str, model_: str, prompt_: List[str], user_msg: str):
    client = OpenAI(api_key=openai_api_key)
    
    prompt = "".join(prompt_)
    
    with open(transcription_path, "r", encoding="utf-8") as txt_file:
        response = client.chat.completions.create(
            model=model_,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"{user_msg}{txt_file.read()}"}
            ]
        )

    return response.choices[0].message.content

def save_summary(summary: str, output_path: str):
    with open(output_path, "w", encoding="utf-8") as md_file:
        md_file.write(summary)
    
def split_summary(summary: str) -> List[str]:
    blocks = []
    block = ""
    
    for line in summary.split("\n"):
        if len(block) + len(line) > 2000:
            blocks.append(block)
            block = ""
        block += line + "\n"
        
    if block:
        blocks.append(block)
        
    return blocks
